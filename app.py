from flask import Flask, render_template, request, jsonify, session
import ollama
import joblib
import pandas as pd
import json
import os
import re

from modelo_bayesiano import MotorBayesiano
from motor_rotacion import MotorRotacionAgronomico

try:
    from predicciones.modeloprediccion import obtener_clima_actual, evaluar_agronomico
except ImportError:
    def obtener_clima_actual(zona):
        return {'GWETROOT': 0.60, 'T2M_MIN': 2.0, 'T2M_MAX': 16.0, 'RH2M': 65.0, 'precipitacion': 100.0, 'NDVI': 0.70, 'Pendiente_SRTM': 5.0}
    def evaluar_agronomico(cultivo, zona):
        return {"error": "Módulo agronómico no disponible."}

app = Flask(__name__)
app.secret_key = "tio_sapo_secreto_12345" 

motor_bayes = MotorBayesiano()
motor_rot = MotorRotacionAgronomico()

try:
    with open('agent.md', 'r', encoding='utf-8') as f:
        SYSTEM_PROMPT = f.read()
except:
    SYSTEM_PROMPT = "Eres Tu Tío Sapo."

# ==========================================
# FUNCIONES DE EXTRACCIÓN (A prueba de errores)
# ==========================================
def extraer_cultivo(texto):
    texto = texto.lower()
    if 'papa' in texto or re.search(r'\ba\b', texto): return 'Papa'
    if 'oca' in texto or re.search(r'\bb\b', texto): return 'Oca'
    if 'haba' in texto or re.search(r'\bc\b', texto): return 'Haba'
    if 'cebada' in texto or re.search(r'\bd\b', texto): return 'Cebada'
    if 'avena' in texto or re.search(r'\be\b', texto): return 'Avena'
    if 'cebolla' in texto or re.search(r'\bf\b', texto): return 'Cebolla'
    if 'alfalfa' in texto or re.search(r'\bg\b', texto): return 'Alfalfa'
    if 'descanso' in texto or re.search(r'\bh\b', texto): return 'Descanso'
    return None

def extraer_zona(texto):
    texto = texto.lower()
    if 'puna' in texto or 'alta' in texto or re.search(r'\ba\b', texto): return 'PUNA'
    if 'planicie' in texto or 'céntrica' in texto or 'centric' in texto or re.search(r'\bb\b', texto): return 'PLANICIE'
    if 'ribera' in texto or 'baja' in texto or re.search(r'\bc\b', texto): return 'RIBERA'
    return None

# ==========================================
# HERRAMIENTAS
# ==========================================
def predecir_rendimiento(cultivo: str, zona: str) -> dict:
    try:
        ruta = f"models/modelo_{cultivo.capitalize()}_{zona.upper()}.pkl"
        if not os.path.exists(ruta): 
            print(f"❌ No se encontró el archivo: {ruta}")
            return {"error": f"No tengo modelo para {cultivo} en {zona.upper()}."}
            
        modelo = joblib.load(ruta)
        clima = obtener_clima_actual(zona.upper())
        X = pd.DataFrame([clima])
        pred = modelo.predict(X)[0]
        return {"rendimiento_t_ha": round(float(pred), 2)}
    except Exception as e: 
        print(f"❌ Error en predicción: {e}")
        return {"error": str(e)}

def evaluar_siembra_con_prediccion(cultivo: str, zona: str) -> dict:
    try:
        clima = obtener_clima_actual(zona.upper())
        return motor_bayes.evaluar_siembra(cultivo, clima['precipitacion'], clima['GWETROOT'], clima['T2M_MIN'])
    except Exception as e: return {"error": str(e)}

def comparar_rotaciones(zona: str, cultivo_anterior: str) -> dict:
    try: return motor_rot.comparar_estrategias(zona.upper(), cultivo_anterior)
    except Exception as e: return {"error": str(e)}

# ==========================================
# RUTAS
# ==========================================
@app.route('/tio-sapo')
def home():
    session.clear()
    session['paso'] = 0  # 0: Inicio, 1: Pide Cultivo, 2: Pide Zona, 3: Pide Anterior
    session['cultivo'] = None
    session['zona'] = None
    session['cultivo_anterior'] = None
    return render_template('index.html')

@app.route('/')
def project_home():
    from flask import send_from_directory
    return send_from_directory(app.root_path, 'index.html')

@app.route('/revisar-hoja')
def route_revisar_hoja():
    from flask import redirect
    return redirect('/modules/diagnostico-hojas/index.html')

@app.route('/llevar-cosecha')
def route_llevar_cosecha():
    from flask import redirect
    return redirect('/modules/formulario-cosecha/index.html')

@app.route('/<path:project_path>')
def project_file(project_path):
    from flask import abort, send_from_directory
    allowed_roots = ('assets/', 'css/', 'data/', 'js/', 'models/', 'modules/', 'prototipos/', 'ayudante de pagina/')
    if project_path != 'index.html' and not project_path.startswith(allowed_roots):
        abort(404)
    return send_from_directory(app.root_path, project_path)

@app.route('/api/chat', methods=['POST'])
def chat():
    mensaje_usuario = request.json.get('mensaje').strip()

    if 'paso' not in session:
        session['paso'] = 0

    # ---------------------------------------------------------
    # MÁQUINA DE ESTADOS (Controlada 100% por Python)
    # ---------------------------------------------------------
    
    if session['paso'] == 0:
        session['paso'] = 1
        return jsonify({"respuesta": "¡Hola sobrino! Soy tu Tío Sapo. ¿Qué cultivo deseas sembrar?\n\na) Papa\nb) Oca\nc) Haba\nd) Cebada\ne) Avena\nf) Cebolla\ng) Alfalfa"})

    elif session['paso'] == 1:
        cultivo = extraer_cultivo(mensaje_usuario)
        if cultivo:
            session['cultivo'] = cultivo
            session['paso'] = 2
            return jsonify({"respuesta": f"¡Excelente elección! {cultivo}. ¿En qué zona de Achacachi te encuentras?\n\na) Puna (Zona alta)\nb) Planicie (Zona céntrica)\nc) Ribera (Zona baja)"})
        else:
            return jsonify({"respuesta": "No te entendí sobrino. Por favor, elige una opción:\n\na) Papa\nb) Oca\nc) Haba\nd) Cebada\ne) Avena\nf) Cebolla\ng) Alfalfa"})

    elif session['paso'] == 2:
        zona = extraer_zona(mensaje_usuario)
        if zona:
            session['zona'] = zona
            session['paso'] = 3
            return jsonify({"respuesta": f"¡Perfecto, zona {zona}! Para terminar, ¿qué cultivo sembraste en esa misma tierra la campaña pasada?\n\na) Papa\nb) Oca\nc) Haba\nd) Cebada\ne) Avena\nf) Cebolla\ng) Alfalfa\nh) Descanso"})
        else:
            return jsonify({"respuesta": "No te entendí. Por favor elige:\n\na) Puna (Zona alta)\nb) Planicie (Zona céntrica)\nc) Ribera (Zona baja)"})

    elif session['paso'] == 3:
        anterior = extraer_cultivo(mensaje_usuario)
        if anterior:
            session['cultivo_anterior'] = anterior
            session['paso'] = 0 # Reiniciar flujo
            
            # EJECUTAMOS HERRAMIENTAS
            print(f"🔧 Evaluando: {session['cultivo']} en {session['zona']}, anterior: {anterior}")
            
            res_rend = predecir_rendimiento(session['cultivo'], session['zona'])
            res_siembra = evaluar_siembra_con_prediccion(session['cultivo'], session['zona'])
            res_rot = comparar_rotaciones(session['zona'], anterior)
            
            # Manejo de errores para que Mistral no diga "Error t/ha"
            if 'error' in res_rend:
                txt_rendimiento = "No pude obtener los datos de los satélites (revisar modelos)."
            else:
                txt_rendimiento = f"{res_rend['rendimiento_t_ha']} t/ha"

            txt_siembra = res_siembra.get('mensaje', 'No disponible')
            
            if 'recomendacion_principal' in res_rot:
                txt_rotacion = res_rot['recomendacion_principal'].get('recomendacion', 'No disponible')
            else:
                txt_rotacion = "No disponible"

            prompt_final = f"""
            El usuario quiere sembrar {session['cultivo']} en {session['zona']}. El año pasado sembró {anterior}.
            Estos son los datos reales:
            - Rendimiento: {txt_rendimiento}
            - Siembra: {txt_siembra}
            - Rotación: {txt_rotacion}
            
            Redacta la respuesta final siguiendo estrictamente el formato del agent.md.
            """
            
            response = ollama.chat(
                model='mistral',
                messages=[
                    {'role': 'system', 'content': SYSTEM_PROMPT},
                    {'role': 'user', 'content': prompt_final}
                ],
                options={'temperature': 0.1}
            )
            
            return jsonify({"respuesta": response.message.content})
        else:
            return jsonify({"respuesta": "No te entendí. Por favor elige qué sembraste:\n\na) Papa\nb) Oca\nc) Haba\nd) Cebada\ne) Avena\nf) Cebolla\ng) Alfalfa\nh) Descanso"})

    return jsonify({"respuesta": "Ocurrió un error inesperado."})

if __name__ == '__main__':
    print("🐸 Servidor de Tu Tío Sapo listo en http://127.0.0.1:5000")
    app.run(debug=True, port=5000)