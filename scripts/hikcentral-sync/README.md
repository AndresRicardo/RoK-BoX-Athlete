# Agente de Sincronización HikCentral Access Control -> RöK BoX Supabase

Este servicio ligero se ejecuta en segundo plano en el PC con Windows del box donde está instalado **HikCentral Access Control**. Lee periódicamente los atletas registrados en el huellero / reconocimiento facial y sincroniza sus fechas de vencimiento de mensualidad con la base de datos de Supabase.

---

## 🚀 Instalación en 3 Pasos en el PC del Box

### Paso 1: Configurar Variables de Entorno
1. Copia el archivo `.env.example` y renómbralo como `.env` dentro de esta carpeta.
2. Abre `.env` con el Bloc de notas y completa:
   - `SUPABASE_URL`: Tu URL de Supabase.
   - `SUPABASE_SERVICE_ROLE_KEY`: La clave secreta `service_role` de Supabase (Project Settings > API).
   - Configura el modo (`openapi` si tienes HikCentral OpenAPI o `direct_db` si prefieres conectar directo a la base de datos local).

### Paso 2: Probar Sincronización Manual
Abre una ventana de PowerShell o CMD en esta carpeta y ejecuta:
```bash
pip install -r requirements.txt
python sync_agent.py --once
```
Verás en consola cómo lee a los atletas de HikCentral y actualiza las filas en la tabla `memberships` de Supabase.

### Paso 3: Dejarlo Automático en Windows
Haz clic derecho en `install_service.bat` y selecciona **Ejecutar como Administrador**.
Esto creará una tarea programada en Windows que:
- Se iniciará automáticamente cada vez que se encienda el PC del box.
- Sincronizará cada 5 minutos en segundo plano sin ventanas molestas.
- Guardará registro de operaciones en `sync_agent.log`.

---

## 🛡️ ¿Cómo se Vinculan los Atletas?
1. En HikCentral, cada atleta tiene registrado su número de **Cédula / DNI** (en el campo `Certificate Number` o `Person ID`).
2. En la PWA móvil de RöK BoX, el atleta va a su **Perfil** e introduce su número de Cédula.
3. El agente de sincronización empareja automáticamente la Cédula de HikCentral con el usuario de la app, permitiéndole ver:
   - Estado de su membresía (`Al día`, `Por vencer`, `En mora`).
   - Conteo regresivo de días restantes.
   - Estado del torniquete / huellero (`Acceso habilitado` o `Acceso restringido`).
