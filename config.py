import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'pentest-dev-key'
    GRAPH_DB_PATH = os.environ.get('GRAPH_DB_PATH') or 'graph_data.json'
    API_VERSION = 'v1'
    