"""
Cliente de conexión con HikCentral Access Control
Soporta:
1. HikCentral OpenAPI (Protocolo Artemis con firma HMAC-SHA256)
2. Consulta directa a Base de Datos Local (SQL Server / PostgreSQL)
"""

import os
import time
import uuid
import hmac
import base64
import hashlib
import json
import logging
import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
logger = logging.getLogger('HikCentralClient')


class HikCentralOpenAPIClient:
    def __init__(self, host, port, app_key, app_secret):
        self.base_url = f"https://{host}:{port}"
        self.app_key = app_key
        self.app_secret = app_secret

    def _generate_signature(self, method, uri, headers_to_sign):
        # Firma estándar Hikvision Artemis
        string_to_sign = f"{method}\n*/*\napplication/json\n"
        headers_str = ""
        for k in sorted(headers_to_sign.keys()):
            headers_str += f"{k}:{headers_to_sign[k]}\n"
        string_to_sign += headers_str
        string_to_sign += uri

        signature = hmac.new(
            self.app_secret.encode('utf-8'),
            string_to_sign.encode('utf-8'),
            hashlib.sha256
        ).digest()

        return base64.b64encode(signature).decode('utf-8')

    def get_persons(self, page_no=1, page_size=100):
        """Obtiene la lista de atletas registrados con su Cédula y vigencia en HikCentral."""
        uri = "/artemis/api/resource/v1/person/advance/personList"
        url = f"{self.base_url}{uri}"
        timestamp = str(int(time.time() * 1000))
        nonce = str(uuid.uuid4())

        headers = {
            "Accept": "*/*",
            "Content-Type": "application/json",
            "x-ca-key": self.app_key,
            "x-ca-timestamp": timestamp,
            "x-ca-nonce": nonce,
            "x-ca-signature-headers": "x-ca-key,x-ca-nonce,x-ca-timestamp",
        }

        headers_to_sign = {
            "x-ca-key": self.app_key,
            "x-ca-nonce": nonce,
            "x-ca-timestamp": timestamp,
        }

        headers["x-ca-signature"] = self._generate_signature("POST", uri, headers_to_sign)

        payload = {
            "pageNo": page_no,
            "pageSize": page_size,
        }

        try:
            response = requests.post(url, headers=headers, json=payload, verify=False, timeout=10)
            data = response.json()
            if data.get("code") == "0":
                return data.get("data", {}).get("list", [])
            else:
                logger.error(f"Error de HikCentral OpenAPI: {data.get('msg')} (código: {data.get('code')})")
                return []
        except Exception as e:
            logger.error(f"Fallo al conectar con HikCentral OpenAPI: {e}")
            return []


class HikCentralDatabaseClient:
    def __init__(self, db_type, host, port, db_name, user, password):
        self.db_type = db_type
        self.host = host
        self.port = port
        self.db_name = db_name
        self.user = user
        self.password = password

    def get_persons(self):
        """Consulta la base de datos SQL Server o PostgreSQL de HikCentral."""
        records = []
        try:
            if self.db_type == 'mssql':
                import pyodbc
                conn_str = f"DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={self.host},{self.port};DATABASE={self.db_name};UID={self.user};PWD={self.password}"
                with pyodbc.connect(conn_str, timeout=5) as conn:
                    cursor = conn.cursor()
                    query = """
                        SELECT 
                            person_id,
                            person_name,
                            certificate_no,
                            begin_time,
                            end_time
                        FROM tbl_person
                        WHERE certificate_no IS NOT NULL AND certificate_no <> ''
                    """
                    cursor.execute(query)
                    for row in cursor.fetchall():
                        records.append({
                            "personId": str(row[0]),
                            "personName": str(row[1]),
                            "certificateNo": str(row[2]),
                            "beginTime": str(row[3]) if row[3] else None,
                            "endTime": str(row[4]) if row[4] else None,
                        })
            elif self.db_type == 'postgresql':
                import psycopg2
                with psycopg2.connect(
                    host=self.host, port=self.port, dbname=self.db_name, user=self.user, password=self.password
                ) as conn:
                    with conn.cursor() as cursor:
                        query = """
                            SELECT 
                                person_id,
                                person_name,
                                certificate_no,
                                begin_time,
                                end_time
                            FROM tbl_person
                            WHERE certificate_no IS NOT NULL AND certificate_no <> ''
                        """
                        cursor.execute(query)
                        for row in cursor.fetchall():
                            records.append({
                                "personId": str(row[0]),
                                "personName": str(row[1]),
                                "certificateNo": str(row[2]),
                                "beginTime": str(row[3]) if row[3] else None,
                                "endTime": str(row[4]) if row[4] else None,
                            })
        except Exception as e:
            logger.error(f"Fallo al consultar base de datos HikCentral: {e}")

        return records
