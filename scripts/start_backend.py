from pathlib import Path
import os
import sys
root=Path(__file__).resolve().parents[1]
os.chdir(root)
sys.path.insert(0,str(root/'backend'))
from dotenv import load_dotenv
from alembic.config import Config
from alembic import command
import uvicorn
load_dotenv(root/'.env')
command.upgrade(Config('backend/alembic.ini'),'head')
uvicorn.run('app.main:app',host='0.0.0.0' if os.getenv('CONTAINER') else '127.0.0.1',port=8000,log_level='info')
