#!/bin/bash
# Read-only check that the Summit key works. Prints only status fields, never the key.
FROM=$(date -u -d '30 days ago' +%Y-%m-%dT00:00:00Z); TO=$(date -u +%Y-%m-%dT23:59:59Z)
set -a; . /etc/elad-network/keyvault/sumit-sipurai.env; set +a
curl -s -m 20 -X POST https://api.sumit.co.il/billing/payments/list/ \
  -H 'Content-Type: application/json' \
  -d "{\"Credentials\":{\"CompanyID\":$SUMIT_COMPANY_ID,\"APIKey\":\"$SUMIT_API_KEY\"},\"Date_From\":\"$FROM\",\"Date_To\":\"$TO\",\"Valid\":true,\"StartIndex\":0}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Status=',d.get('Status'),'| UserError=',d.get('UserErrorMessage'),'| payments on page=',len((d.get('Data') or {}).get('Payments') or []))"
