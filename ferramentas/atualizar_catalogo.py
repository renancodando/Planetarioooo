import argparse
import datetime
import json
import pathlib
import time
import urllib.parse
import urllib.request

argumentos = argparse.ArgumentParser(description='Atualiza o catálogo local do Universo Bifurcado com consultas oficiais sequenciais.')
argumentos.add_argument('--corpos', default='99942,1P')
argumentos.add_argument('--data', default='2026-09-13T12:00:00')
opcoes = argumentos.parse_args()
raiz = pathlib.Path(__file__).resolve().parents[1]
caminho = raiz / 'wwwroot/dados/catalogo.json'
catalogo = json.loads(caminho.read_text()) if caminho.exists() else {'corpos': [], 'encontros': [], 'vetores': []}

def consultar(base, parametros):
    url = base + '?' + urllib.parse.urlencode(parametros)
    req = urllib.request.Request(url, headers={'User-Agent': 'PlanetarioTemporal/2.0', 'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=45) as resposta:
        dados = json.load(resposta)
    if dados.get('code', 200) not in [200, '200'] or dados.get('error'):
        raise ValueError(dados.get('error') or dados.get('message'))
    time.sleep(1)
    return {'fonte': url, 'consultado': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'dados': dados}

def salvar():
    temporario = caminho.with_suffix('.tmp')
    temporario.write_text(json.dumps(catalogo, ensure_ascii=False, indent=2))
    temporario.replace(caminho)

for designacao in opcoes.corpos.split(','):
    try:
        resultado = consultar('https://ssd-api.jpl.nasa.gov/sbdb.api', {'sstr': designacao, 'cov': 'mat', 'full-prec': 'true', 'phys-par': 'true', 'ca-data': 'true'})
        if resultado['dados'].get('signature', {}).get('version') != '1.3':
            raise ValueError('Versão SBDB não reconhecida')
        catalogo['corpos'] = [c for c in catalogo['corpos'] if c['dados']['object']['des'] != resultado['dados']['object']['des']]
        catalogo['corpos'].append(resultado)
        salvar()
        print('SBDB:', designacao, flush=True)
    except Exception as erro:
        print('Falha SBDB:', designacao, str(erro), flush=True)

for corpo in ['Earth', 'Moon', 'Mars', 'Juptr']:
    try:
        resultado = consultar('https://ssd-api.jpl.nasa.gov/cad.api', {'body': corpo, 'date-min': '2026-01-01', 'date-max': '2031-01-01', 'dist-max': '2' if corpo == 'Juptr' else '0.1', 'sort': 'date', 'limit': '60', 'diameter': 'true'})
        if resultado['dados'].get('signature', {}).get('version') != '1.5':
            raise ValueError('Versão CAD não reconhecida')
        resultado['corpo'] = corpo
        catalogo['encontros'] = [e for e in catalogo['encontros'] if e['corpo'] != corpo]
        catalogo['encontros'].append(resultado)
        salvar()
        print('CAD:', corpo, flush=True)
    except Exception as erro:
        print('Falha CAD:', corpo, str(erro), flush=True)

instante = datetime.datetime.fromisoformat(opcoes.data).replace(tzinfo=datetime.timezone.utc)
jd = instante.timestamp() / 86400 + 2440587.5
for identificador, comando in [('mercurio','199'),('venus','299'),('terra','399'),('lua','301'),('marte','499'),('jupiter','5'),('saturno','6'),('urano','7'),('netuno','8'),('99942','99942;'),('voyager1','-31')]:
    try:
        resposta = consultar('https://ssd.jpl.nasa.gov/api/horizons.api', {'format': 'json', 'COMMAND': comando, 'EPHEM_TYPE': 'VECTORS', 'CENTER': '500@10', 'TLIST': str(jd), 'TLIST_TYPE': 'JD', 'OUT_UNITS': 'AU-D', 'REF_PLANE': 'ECLIPTIC', 'VEC_TABLE': '2', 'CSV_FORMAT': 'YES', 'OBJ_DATA': 'NO'})
        if resposta['dados'].get('signature', {}).get('version') not in ['1.2','1.3']:
            raise ValueError('Versão Horizons não reconhecida')
        texto = resposta['dados']['result']
        linha = texto.split('$$SOE')[1].split('$$EOE')[0].strip().splitlines()[0]
        valores = [v.strip() for v in linha.split(',')]
        estado = {'id': identificador, 'jd': float(valores[0]), 'posicao': [float(valores[2]), float(valores[3]), float(valores[4])], 'velocidade': [float(valores[5]), float(valores[6]), float(valores[7])], 'fonte': resposta['fonte'], 'consultado': resposta['consultado'], 'referencial': 'Sol; ECLIPTIC J2000; TDB; AU-D'}
        catalogo['vetores'] = [v for v in catalogo['vetores'] if not (v['id'] == identificador and abs(v['jd']-jd)<1e-8)]
        catalogo['vetores'].append(estado)
        salvar()
        print('Horizons:', identificador, flush=True)
    except Exception as erro:
        print('Falha Horizons:', identificador, str(erro), flush=True)
