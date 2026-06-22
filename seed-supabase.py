"""
Seed script: Populates the Supabase database with NR 11 training data.
Uses the service_role key to bypass RLS.
"""
import requests, json, sys

SUPABASE_URL = "https://svavwwfjnyhzmkviwnwx.supabase.co"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2YXZ3d2Zqbnloem1rdml3bnd4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjA2NzczNiwiZXhwIjoyMDk3NjQzNzM2fQ.f15LVsGWfvf_g2UN-YNDL5JD9Vtk8dvPtSUUc-OZrOo"

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

def api(method, table, data=None, params=""):
    url = f"{SUPABASE_URL}/rest/v1/{table}{params}"
    r = getattr(requests, method)(url, headers=HEADERS, json=data)
    if r.status_code >= 400:
        print(f"ERROR {method.upper()} {table}: {r.status_code} {r.text}")
        sys.exit(1)
    return r.json() if r.text else None

# 1. Check if data already exists
existing = api("get", "trainings", params="?select=id&limit=1")
if existing and len(existing) > 0:
    print("Data already exists. Skipping seed.")
    sys.exit(0)

print("Seeding database...")

# 2. Create category
print("  Creating NR 11 category...")
cat = api("post", "training_categories", {
    "nome": "NR 11",
    "nr": "NR 11",
    "descricao": "Norma Regulamentadora 11 - Transporte, Movimentacao, Armazenagem e Manuseio de Materiais"
})
cat_id = cat[0]["id"]
print(f"  Category ID: {cat_id}")

# 3. Create training
print("  Creating NR 11 training...")
training = api("post", "trainings", {
    "titulo": "NR 11 - Operacao de Empilhadeiras",
    "descricao": "Treinamento obrigatorio sobre seguranca na operacao de empilhadeiras.",
    "objetivo": "Regulamentar a movimentacao, armazenagem e manuseio de materiais com seguranca.",
    "category_id": cat_id,
    "nr": "NR 11",
    "carga_horaria_minutos": 240,
    "nota_minima": 70,
    "max_tentativas": 3,
    "validade_meses": 12,
    "exigir_video_100": True,
    "permitir_avanco_video": False,
    "bloquear_avanco_video": True,
    "status": "publicado"
})
t_id = training[0]["id"]
print(f"  Training ID: {t_id}")

# 4. Create training media (YouTube video)
print("  Creating video media...")
media = api("post", "training_media", {
    "training_id": t_id,
    "provider": "youtube_privado",
    "external_url": "https://youtu.be/wOQVuxjw3Lo",
    "duracao_segundos": 600
})
print(f"  Media ID: {media[0]['id']}")

# 5. Create questions and alternatives
questions_data = [
    {
        "text": "Qual e o principal objetivo da NR 11?",
        "options": [
            ("A", "Aumentar a produtividade da empresa.", False),
            ("B", "Regulamentar a movimentacao, armazenagem e manuseio de materiais com seguranca.", True),
            ("C", "Controlar a jornada de trabalho dos operadores.", False),
            ("D", "Fiscalizar o uso de uniformes.", False),
        ]
    },
    {
        "text": "Antes de iniciar a operacao da empilhadeira, o operador deve:",
        "options": [
            ("A", "Verificar as condicoes do equipamento.", True),
            ("B", "Apenas abastecer o equipamento.", False),
            ("C", "Ligar a empilhadeira imediatamente.", False),
            ("D", "Solicitar autorizacao dos colegas.", False),
        ]
    },
    {
        "text": "Ao transportar uma carga, os garfos devem permanecer:",
        "options": [
            ("A", "Totalmente elevados.", False),
            ("B", "Aproximadamente 15 a 20 cm do solo.", True),
            ("C", "Tocando o chao.", False),
            ("D", "Na altura dos ombros do operador.", False),
        ]
    },
    {
        "text": "Durante a operacao da empilhadeira, o uso do cinto de seguranca e:",
        "options": [
            ("A", "Opcional.", False),
            ("B", "Necessario apenas em areas externas.", False),
            ("C", "Obrigatorio.", True),
            ("D", "Necessario apenas para cargas pesadas.", False),
        ]
    },
    {
        "text": "Ao se aproximar de cruzamentos e areas com circulacao de pedestres, o operador deve:",
        "options": [
            ("A", "Aumentar a velocidade.", False),
            ("B", "Manter a buzina acionada continuamente.", False),
            ("C", "Reduzir a velocidade e redobrar a atencao.", True),
            ("D", "Ignorar a sinalizacao.", False),
        ]
    },
    {
        "text": "Quando a carga impedir a visibilidade frontal, o operador deve:",
        "options": [
            ("A", "Continuar normalmente.", False),
            ("B", "Trafegar em marcha a re, observando o trajeto.", True),
            ("C", "Pedir ajuda apenas ao final do percurso.", False),
            ("D", "Aumentar a velocidade para concluir a manobra rapidamente.", False),
        ]
    },
    {
        "text": "Qual das opcoes representa um habito seguro durante a operacao?",
        "options": [
            ("A", "Transportar passageiros na empilhadeira.", False),
            ("B", "Utilizar celular enquanto dirige.", False),
            ("C", "Respeitar os limites de velocidade e a sinalizacao.", True),
            ("D", "Operar com a carga elevada.", False),
        ]
    },
    {
        "text": "Ao estacionar a empilhadeira, o operador deve:",
        "options": [
            ("A", "Deixar os garfos elevados.", False),
            ("B", "Desligar o equipamento e baixar totalmente os garfos.", True),
            ("C", "Deixar o motor ligado.", False),
            ("D", "Estacionar em qualquer local disponivel.", False),
        ]
    },
    {
        "text": "Quem esta autorizado a operar uma empilhadeira?",
        "options": [
            ("A", "Qualquer colaborador do setor.", False),
            ("B", "Apenas supervisores.", False),
            ("C", "Trabalhadores treinados, capacitados e autorizados.", True),
            ("D", "Visitantes acompanhados.", False),
        ]
    },
    {
        "text": "A operacao consciente e preventiva contribui para:",
        "options": [
            ("A", "Reducao de acidentes e danos materiais.", True),
            ("B", "Aumento do consumo de combustivel.", False),
            ("C", "Reducao da vida util do equipamento.", False),
            ("D", "Eliminacao da necessidade de treinamento.", False),
        ]
    },
]

print(f"  Creating {len(questions_data)} questions with alternatives...")
for i, q in enumerate(questions_data):
    question = api("post", "questions", {
        "training_id": t_id,
        "pergunta": q["text"],
        "peso": 10,
        "ordem": i + 1
    })
    q_id = question[0]["id"]
    
    alts = [{"question_id": q_id, "letra": letra, "texto": texto, "correta": correta} for letra, texto, correta in q["options"]]
    api("post", "alternatives", alts)
    print(f"    Q{i+1}: {q_id}")

print("\nSeed complete! NR 11 training data is now in the database.")
