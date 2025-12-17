import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'pentest-dev-key'
    GRAPH_DB_DIR = 'data'  # Directory for multiple JSON files
    API_VERSION = 'v1'
