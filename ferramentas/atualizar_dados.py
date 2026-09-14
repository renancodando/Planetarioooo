import argparse
import datetime
import json
import pathlib
import time
import urllib.parse
import urllib.request

parser = argparse.ArgumentParser(description='Atualiza arquivos científicos locais por consultas sequenciais oficiais JPL.')
parser.add_argument('--data', default=datetime.date.today().isoformat())
parser.add_argument('--corpo', default='Ceres')
parser.add_argument('--fonte', choices=['todas','horizons','jd','sbdb','cad','sentry','scout'], default='todas')
parser.add_argument('--validar-epocas', action='store_true')
parser.add_argument('--saida', default=str(pathlib.Path(__file__).resolve().parents[1] / 'wwwroot/dados/jpl.json'))
argumentos = parser.parse_args()
data = datetime.datetime.fromisoformat(argumentos.data).replace(tzinfo=datetime.timezone.utc)
jd = data.timestamp()/86400+2440587.5
caminho = pathlib.Path(argumentos.saida)
resultado = json.loads(caminho.read_text(encoding='utf-8')) if caminho.exists() else {'fontes':{}}
versoes = {'horizons':['1.2','1.3'],'jd':['0.1'],'sbdb':['1.3'],'cad':['1.5'],'sentry':['2.0'],'scout':['1.3']}
falhas = []

def salvar():
    resultado['gerado'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    caminho.parent.mkdir(parents=True,exist_ok=True)
    temporario = caminho.with_suffix('.tmp')
    temporario.write_text(json.dumps(resultado,ensure_ascii=False,indent=2),encoding='utf-8')
    temporario.replace(caminho)

def consultar(nome,base,parametros):
    url = base+'?'+urllib.parse.urlencode(parametros)
    requisicao = urllib.request.Request(url,headers={'User-Agent':'PlanetarioTemporal/1.0','Accept':'application/json'})
    with urllib.request.urlopen(requisicao,timeout=40) as resposta:
        dados = json.load(resposta)
    if 'error' in dados or dados.get('code',200) not in [200,'200']:
        raise ValueError(dados.get('error') or dados.get('message','Consulta não resolvida'))
    versao = dados.get('signature',{}).get('version')
    if versao not in versoes.get(nome,[]):
        raise ValueError('Versão '+str(versao)+' não reconhecida. Confira o esquema oficial antes de atualizar a lista de versões aceitas.')
    time.sleep(1)
    return {'consultado':datetime.datetime.now(datetime.timezone.utc).isoformat(),'url':url,'versao':versao,'dados':dados}

consultas = {
    'jd': ('https://ssd-api.jpl.nasa.gov/jd_cal.api', {'jd':str(jd)}),
    'sbdb': ('https://ssd-api.jpl.nasa.gov/sbdb.api', {'sstr':argumentos.corpo,'phys-par':'true','full-prec':'true'}),
    'cad': ('https://ssd-api.jpl.nasa.gov/cad.api', {'date-min':argumentos.data,'date-max':(data+datetime.timedelta(days=365)).strftime('%Y-%m-%d'),'dist-max':'0.05','sort':'date','limit':'30'}),
    'sentry': ('https://ssd-api.jpl.nasa.gov/sentry.api', {'ps-min':'-4'}),
    'scout': ('https://ssd-api.jpl.nasa.gov/scout.api', {})
}
if argumentos.fonte in ['todas','horizons']:
    amostras = []
    epocas = [jd]
    if argumentos.validar_epocas:
        epocas = [datetime.datetime(a,m,d,tzinfo=datetime.timezone.utc).timestamp()/86400+2440587.5 for a,m,d in [(1500,9,11),(1969,7,20),(2000,1,1),(2026,9,11),(2350,3,14),(3000,1,1)]]
    for indice in range(8):
        try:
            parametros={'format':'json','COMMAND':str(indice+1),'EPHEM_TYPE':'VECTORS','CENTER':'500@10','TLIST':','.join(str(x) for x in epocas),'TLIST_TYPE':'JD','OUT_UNITS':'AU-D','REF_PLANE':'ECLIPTIC','VEC_TABLE':'2','CSV_FORMAT':'YES','OBJ_DATA':'NO','CAL_TYPE':'GREGORIAN'}
            entrada=consultar('horizons','https://ssd.jpl.nasa.gov/api/horizons.api',parametros)
            texto=entrada['dados'].get('result','')
            if '$$SOE' not in texto:
                raise ValueError('Resposta sem vetores orbitais')
            for linha in texto.split('$$SOE')[1].split('$$EOE')[0].strip().splitlines():
                campos=[c.strip() for c in linha.split(',')]
                amostras.append({'planeta':indice,'jd':float(campos[0]),'posicao':[float(campos[2]),float(campos[4]),-float(campos[3])],'velocidade':[float(campos[5]),float(campos[7]),-float(campos[6])],'fonte':entrada['url']})
            print('Horizons: planeta '+str(indice+1)+' consultado',flush=True)
        except Exception as erro:
            falhas.append('horizons-'+str(indice))
            print('Horizons: '+str(erro),flush=True)
    if amostras:
        resultado['fontes']['horizons']={'consultado':datetime.datetime.now(datetime.timezone.utc).isoformat(),'versao':entrada['versao'],'dados':{'referencial':'ECLIPTIC J2000; Sol; TDB; AU; coordenadas gráficas x,z,-y','amostras':amostras}}
        salvar()
for nome,(base,parametros) in consultas.items():
    if argumentos.fonte not in ['todas',nome]:
        continue
    try:
        resultado['fontes'][nome]=consultar(nome,base,parametros)
        salvar()
        print(nome+': consulta salva',flush=True)
    except Exception as erro:
        falhas.append(nome)
        print(nome+': '+str(erro),flush=True)
        if isinstance(erro,urllib.error.HTTPError) and erro.code==429:
            break
print('Arquivo: '+str(caminho))
if falhas:
    raise SystemExit(1)
