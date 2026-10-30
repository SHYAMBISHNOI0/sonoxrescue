"""Create local secrets once, without printing them or overwriting user configuration."""
from pathlib import Path
import secrets
target=Path(__file__).resolve().parents[1]/'.env'
if not target.exists():
    target.write_text('SESSION_SECRET='+secrets.token_hex(32)+'\nDEMO_PASSWORD='+secrets.token_urlsafe(18)+'\nPOSTGRES_PASSWORD='+secrets.token_hex(16)+'\nORTHANC_USER=sonorescue\nORTHANC_PASSWORD='+secrets.token_hex(16)+'\n')
    target.chmod(0o600)
    print('Created .env with generated local credentials. Demo password is stored in DEMO_PASSWORD.')
else:print('Existing .env retained.')
