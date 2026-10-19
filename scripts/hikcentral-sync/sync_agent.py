"""
RöK BoX — Agente de Sincronización HikCentral Access Control -> Supabase
Ejecuta de forma periódica en el PC del box para mantener actualizadas las
membresías, vencimientos y permisos del huellero en la nube.
"""

import os
import sys
import time
import logging
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client
from hikcentral_client import HikCentralOpenAPIClient, HikCentralDatabaseClient

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(Path(__file__).parent / 'sync_agent.log', encoding='utf-8')
    ]
)
logger = logging.getLogger('SyncAgent')

# Cargar variables de entorno
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
SYNC_INTERVAL = int(os.getenv('SYNC_INTERVAL_MINUTES', '5'))
HIK_MODE = os.getenv('HIKCENTRAL_MODE', 'openapi').lower()


def get_supabase_client() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        logger.error("Faltan variables SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env")
        sys.exit(1)
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def get_hik_client():
    if HIK_MODE == 'openapi':
        host = os.getenv('HIKCENTRAL_HOST', '127.0.0.1')
        port = int(os.getenv('HIKCENTRAL_PORT', '443'))
        app_key = os.getenv('HIKCENTRAL_APP_KEY', '')
        app_secret = os.getenv('HIKCENTRAL_APP_SECRET', '')
        return HikCentralOpenAPIClient(host, port, app_key, app_secret)
    else:
        db_type = os.getenv('HIK_DB_TYPE', 'mssql')
        host = os.getenv('HIK_DB_HOST', '127.0.0.1')
        port = int(os.getenv('HIK_DB_PORT', '1433'))
        db_name = os.getenv('HIK_DB_NAME', 'HikCentral_Access')
        user = os.getenv('HIK_DB_USER', 'sa')
        password = os.getenv('HIK_DB_PASSWORD', '')
        return HikCentralDatabaseClient(db_type, host, port, db_name, user, password)


def sync_once(supabase_client: Client, hik_client):
    logger.info("Iniciando ciclo de sincronización...")

    # 1. Obtener atletas desde HikCentral
    hik_persons = hik_client.get_persons()
    logger.info(f"Atletas obtenidos desde HikCentral: {len(hik_persons)}")

    if not hik_persons:
        logger.warning("No se recibieron atletas de HikCentral. Verifica credenciales y conexión.")
        return

    # 2. Obtener mapeo actual de perfiles en Supabase (id, document_id)
    profiles_res = supabase_client.table('profiles').select('id, document_id').execute()
    profiles_by_doc = {}
    for p in profiles_res.data or []:
        if p.get('document_id'):
            profiles_by_doc[str(p['document_id']).strip()] = p['id']

    now = datetime.now(timezone.utc)
    synced_count = 0

    for person in hik_persons:
        doc_id = (person.get('certificateNo') or person.get('personId') or '').strip()
        if not doc_id:
            continue

        end_time_raw = person.get('endTime')
        if not end_time_raw:
            continue

        try:
            # Normalizar fecha de expiración
            if 'T' in end_time_raw:
                end_date = datetime.fromisoformat(end_time_raw.replace('Z', '+00:00'))
            else:
                end_date = datetime.strptime(end_time_raw, '%Y-%m-%d %H:%M:%S').replace(tzinfo=timezone.utc)
        except Exception:
            logger.warning(f"Formato de fecha inválido para persona {doc_id}: {end_time_raw}")
            continue

        diff_days = (end_date - now).total_seconds() / 86400

        if diff_days < 0:
            status = 'overdue'
            access_granted = False
        elif diff_days <= 3:
            status = 'expiring_soon'
            access_granted = True
        else:
            status = 'active'
            access_granted = True

        linked_user_id = profiles_by_doc.get(doc_id)

        payload = {
            'document_id': doc_id,
            'plan_name': 'Mensualidad Box (HikCentral)',
            'end_date': end_date.isoformat(),
            'status': status,
            'access_granted': access_granted,
            'hikvision_person_id': str(person.get('personId') or ''),
            'last_synced_at': now.isoformat(),
        }

        if linked_user_id:
            payload['user_id'] = linked_user_id

        try:
            supabase_client.table('memberships').upsert(
                payload,
                on_conflict='document_id'
            ).execute()
            synced_count += 1
        except Exception as e:
            logger.error(f"Error sincronizando atleta {doc_id}: {e}")

    logger.info(f"Sincronización completada: {synced_count} atletas actualizados en Supabase.")


def main():
    logger.info("=== RöK BoX HikCentral Sync Agent Iniciado ===")
    supabase_client = get_supabase_client()
    hik_client = get_hik_client()

    run_once_mode = '--once' in sys.argv

    while True:
        try:
            sync_once(supabase_client, hik_client)
        except Exception as e:
            logger.error(f"Error inesperado en el ciclo de sincronización: {e}")

        if run_once_mode:
            logger.info("Modo --once ejecutado. Finalizando.")
            break

        logger.info(f"Pausa de {SYNC_INTERVAL} minutos hasta el siguiente ciclo...")
        time.sleep(SYNC_INTERVAL * 60)


if __name__ == '__main__':
    main()
