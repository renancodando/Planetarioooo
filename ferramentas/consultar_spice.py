import argparse
import datetime
import json
import pathlib
import time
import urllib.request

parser=argparse.ArgumentParser(description='Consulta vetores SPICE no WebGeocalc oficial e salva para leitura local.')
parser.add_argument('--data',default='2026-09-11T00:00:00')
parser.add_argument('--alvo',default='MARS')
parser.add_argument('--observador',default='SUN')
parser.add_argument('--kernel',type=int,default=1)
argumentos=parser.parse_args()
base='https://wgc2.jpl.nasa.gov:8443/webgeocalc/api/'

def requisitar(caminho,dados=None):
    corpo=json.dumps(dados).encode() if dados is not None else None
    req=urllib.request.Request(base+caminho,data=corpo,headers={'Content-Type':'application/json','Accept':'application/json','User-Agent':'PlanetarioTemporal/1.0'})
    with urllib.request.urlopen(req,timeout=30) as resposta:
        resultado=json.load(resposta)
    if resultado.get('status')!='OK':
        raise RuntimeError(resultado.get('error',{}).get('shortDescription',resultado.get('message','Falha na consulta SPICE')))
    return resultado

pedido={'kernels':[{'type':'KERNEL_SET','id':argumentos.kernel}],'timeSystem':'TDB','timeFormat':'CALENDAR','times':[argumentos.data.replace('T',' ')],'calculationType':'STATE_VECTOR','targetType':'OBJECT','target':argumentos.alvo,'observerType':'OBJECT','observer':argumentos.observador,'referenceFrame':'ECLIPJ2000','aberrationCorrection':'NONE','stateRepresentation':'RECTANGULAR'}
try:
    tarefa=requisitar('calculation/new',pedido)
    identificador=tarefa['calculationId']
    for tentativa in range(15):
        fase=tarefa.get('result',{}).get('phase')
        if fase=='COMPLETE':
            break
        if fase in ['FAILED','CANCELLED','EXPIRED']:
            raise RuntimeError('Cálculo encerrado: '+str(fase))
        time.sleep(2)
        tarefa=requisitar('calculation/'+identificador)
    else:
        raise RuntimeError('O servidor não concluiu o cálculo no intervalo esperado.')
    dados=requisitar('calculation/'+identificador+'/results')
    caminho=pathlib.Path(__file__).resolve().parents[1]/'wwwroot/dados/jpl.json'
    arquivo=json.loads(caminho.read_text(encoding='utf-8')) if caminho.exists() else {'fontes':{}}
    arquivo['fontes']['webgeocalc']={'consultado':datetime.datetime.now(datetime.timezone.utc).isoformat(),'url':base,'pedido':pedido,'dados':dados}
    caminho.write_text(json.dumps(arquivo,ensure_ascii=False,indent=2),encoding='utf-8')
    print('SPICE: '+str(len(dados.get('rows',[])))+' estado(s) salvos em '+str(caminho))
except Exception as erro:
    print('SPICE: '+str(erro))
    raise SystemExit(1)
