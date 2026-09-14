import datetime
import json
import pathlib
import time
import urllib.parse
import urllib.request

raiz = pathlib.Path(__file__).resolve().parents[1]
resultado = {'titulo': '99942 Apophis × Terra · abril de 2029', 'referencial': 'Sol; ECLIPTIC J2000; TDB; AU-D', 'corpos': {}, 'consultado': datetime.datetime.now(datetime.timezone.utc).isoformat()}
for nome,comando in [('terra','399'),('lua','301'),('apophis','99942;')]:
    parametros = {'format':'json','COMMAND':comando,'EPHEM_TYPE':'VECTORS','CENTER':'500@10','START_TIME':'2029-04-12','STOP_TIME':'2029-04-15','STEP_SIZE':'10m','OUT_UNITS':'AU-D','REF_PLANE':'ECLIPTIC','VEC_TABLE':'2','CSV_FORMAT':'YES','OBJ_DATA':'NO'}
    url='https://ssd.jpl.nasa.gov/api/horizons.api?'+urllib.parse.urlencode(parametros)
    with urllib.request.urlopen(url,timeout=60) as r:
        dados=json.load(r)
    if dados.get('signature',{}).get('version') not in ['1.2','1.3']:
        raise ValueError('Versão Horizons não reconhecida')
    tabela=[]
    for linha in dados['result'].split('$$SOE')[1].split('$$EOE')[0].strip().splitlines():
        c=[v.strip() for v in linha.split(',')]
        tabela.append([float(c[0])]+[float(v) for v in c[2:8]])
    resultado['corpos'][nome]={'fonte':url,'amostras':tabela}
    print(nome,len(tabela),flush=True)
    time.sleep(1)
(raiz/'wwwroot/dados/encontro-apophis.json').write_text(json.dumps(resultado,ensure_ascii=False,separators=(',',':')))
