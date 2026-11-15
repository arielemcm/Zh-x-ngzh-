# -*- coding: utf-8 -*-
import glob, os, warnings
import numpy as np
import pandas as pd
from statsmodels.tsa.statespace.sarimax import SARIMAX

warnings.filterwarnings('ignore')

# 0. CONFIGURACIÓN DE RUTAS (Ajustado a tu estructura)
RUTA_BASE = os.path.dirname(os.path.abspath(__file__))
RUTA_CHIRPS = os.path.join(RUTA_BASE, 'chirps')
RUTA_POWER = os.path.join(RUTA_BASE, 'nasapower')
RUTA_MODIS = os.path.join(RUTA_BASE, 'resultados_MODIS')
RUTA_PENDIENTE = os.path.join(RUTA_BASE, 'resultados_pendiente')

def limpiar_float(val):
  if pd.isna(val): return 0.0
  if isinstance(val, (int, float)): return float(val)
  return float(str(val).replace(',', '.'))

def cargar_pendientes():
  pendientes = {}
  archivo_gen = os.path.join(RUTA_PENDIENTE, 'Pendiente_GENERAL.csv')
  if os.path.exists(archivo_gen):
    df = pd.read_csv(archivo_gen, sep=None, engine='python', encoding='utf-8-sig')
    for _, row in df.iterrows():
      zona = str(row['zona']).capitalize()
      pendientes[zona] = limpiar_float(row['pendiente_media_pct'])
  return pendientes

PENDIENTES_ZONA = cargar_pendientes()

# ==========================================
# LÓGICA DE ENTRENAMIENTO (Se ejecuta una vez al iniciar Flask)
# ==========================================
pisos = ['Planicie', 'Rivera', 'Puna']
config_nombres = {
    'Planicie': {'power': 'planicie', 'chirps': 'PLANICIE', 'modis': 'PLANICIE'},
    'Rivera': {'power': 'ribera', 'chirps': 'RIBERA', 'modis': 'RIBERA'},
    'Puna': {'power': 'puna', 'chirps': 'PUNA', 'modis': 'PUNA'},
}
df_pronostico_3m = pd.DataFrame()

print("⏳ Entrenando SARIMAX para predicciones...")
try:
    pronosticos_por_piso = {}
    for piso in pisos:
        cfg = config_nombres[piso]
        path_power = os.path.join(RUTA_POWER, f"achacachi_power_{cfg['power']}_2013_2024.csv")
        df_p = pd.read_csv(path_power, sep=None, engine='python', encoding='utf-8-sig')
        for col in ['T2M_MIN', 'T2M_MAX', 'GWETROOT', 'RH2M']:
            if col in df_p.columns: df_p[col] = df_p[col].apply(limpiar_float)
        df_p['date'] = pd.to_datetime(df_p['date'])
        df_p = df_p.set_index('date').sort_index()

        path_chirps = os.path.join(RUTA_CHIRPS, f"CHIRPS_{cfg['chirps']}_2013_2024.csv")
        df_c = pd.read_csv(path_chirps, sep=None, engine='python', encoding='utf-8-sig')
        df_c['precipitacion'] = df_c['precipitacion'].apply(limpiar_float)
        df_c['fecha'] = pd.to_datetime(df_c['fecha'])
        df_c_diario = df_c.groupby('fecha')['precipitacion'].mean().reset_index().set_index('fecha').sort_index()

        df_mensual = pd.DataFrame()
        df_mensual['T2M_MIN'] = df_p['T2M_MIN'].resample('MS').mean()
        df_mensual['T2M_MAX'] = df_p['T2M_MAX'].resample('MS').mean()
        df_mensual['GWETROOT'] = df_p['GWETROOT'].resample('MS').mean()
        df_mensual['RH2M'] = df_p['RH2M'].resample('MS').mean()
        df_mensual['PREC_CHIRPS'] = df_c_diario['precipitacion'].resample('MS').sum()

        path_modis = os.path.join(RUTA_MODIS, f'MODIS_NDVI_{cfg["modis"]}_2013_2024.csv')
        if os.path.exists(path_modis):
            df_m = pd.read_csv(path_modis, sep=None, engine='python', encoding='utf-8-sig')
            df_m['NDVI'] = df_m['NDVI'].apply(limpiar_float)
            df_m['fecha'] = pd.to_datetime(df_m['fecha'])
            ndvi_s = df_m.set_index('fecha')['NDVI'].resample('MS').mean()
            df_mensual['NDVI'] = ndvi_s
            df_mensual['NDVI'] = df_mensual['NDVI'].interpolate().bfill()
        else:
            df_mensual['NDVI'] = 0.35

        df_mensual = df_mensual.dropna()
        pronosticos_piso = {}
        vars_a_predecir = ['T2M_MIN', 'T2M_MAX', 'GWETROOT', 'RH2M', 'PREC_CHIRPS', 'NDVI']

        for var in vars_a_predecir:
            serie = df_mensual[var]
            modelo = SARIMAX(serie, order=(1, 0, 1), seasonal_order=(1, 1, 1, 12), enforce_stationarity=False, enforce_invertibility=False).fit(disp=False)
            pred = modelo.forecast(steps=3)
            if var in ['GWETROOT', 'PREC_CHIRPS', 'NDVI']: pred = pred.clip(lower=0.0)
            pronosticos_piso[var] = pred

        df_pred = pd.DataFrame(pronosticos_piso)
        df_pred['Fecha'] = pd.date_range(start='2026-12-01', periods=3, freq='MS')
        df_pred['Piso'] = piso
        pronosticos_por_piso[piso] = df_pred

    df_pronostico_3m = pd.concat(pronosticos_por_piso.values(), ignore_index=True)
    print("✅ Predicciones SARIMAX cargadas y listas.")
except Exception as e:
    print(f"❌ Error cargando SARIMAX: {e}. Se usarán valores promedio.")

# ==========================================
# FUNCIONES EXPORTABLES PARA EL AGENTE
# ==========================================

def obtener_clima_actual(zona: str) -> dict:
    """Devuelve el promedio climático predicho para los próximos 3 meses (formato .pkl)"""
    zona_limpia = zona.capitalize()
    if df_pronostico_3m.empty:
        # Fallback si SARIMAX falló
        return {'GWETROOT': 0.60, 'T2M_MIN': 2.0, 'T2M_MAX': 16.0, 'RH2M': 65.0, 'precipitacion': 100.0, 'NDVI': 0.70, 'Pendiente_SRTM': 5.0}
    
    df_zona = df_pronostico_3m[df_pronostico_3m['Piso'] == zona_limpia]
    if df_zona.empty:
        df_zona = df_pronostico_3m[df_pronostico_3m['Piso'] == 'Planicie'] # Fallback

    # Promediamos los 3 meses para tener un dato representativo
    return {
        'GWETROOT': round(float(df_zona['GWETROOT'].mean()), 2),
        'T2M_MIN': round(float(df_zona['T2M_MIN'].mean()), 1),
        'T2M_MAX': round(float(df_zona['T2M_MAX'].mean()), 1),
        'RH2M': round(float(df_zona['RH2M'].mean()), 1),
        'precipitacion': round(float(df_zona['PREC_CHIRPS'].mean()), 1),
        'NDVI': round(float(df_zona['NDVI'].mean()), 2),
        'Pendiente_SRTM': PENDIENTES_ZONA.get(zona_limpia, 5.0)
    }

def evaluar_agronomico(cultivo: str, zona: str) -> dict:
    """Evalúa si el cultivo es apto según el catálogo y las predicciones SARIMAX."""
    zona_limpia = zona.capitalize()
    df_zona = df_pronostico_3m[df_pronostico_3m['Piso'] == zona_limpia]
    if df_zona.empty: return {"error": "Zona no encontrada"}

    catalogo = {
        'Papa': {'prec_min': 45.0, 'gwet_root_min': 0.58, 't_min_critica': 0.0},
        'Quinua': {'prec_min': 30.0, 'gwet_root_min': 0.50, 't_min_critica': -1.5},
        'Haba': {'prec_min': 50.0, 'gwet_root_min': 0.62, 't_min_critica': 0.5},
        'Cebada': {'prec_min': 35.0, 'gwet_root_min': 0.54, 't_min_critica': -1.0},
        'Avena': {'prec_min': 40.0, 'gwet_root_min': 0.56, 't_min_critica': -0.5},
        'Oca': {'prec_min': 45.0, 'gwet_root_min': 0.60, 't_min_critica': 0.0},
        'Cañahua': {'prec_min': 25.0, 'gwet_root_min': 0.48, 't_min_critica': -2.5},
    }
    
    clave = next((k for k in catalogo if k.lower() == cultivo.lower()), None)
    if not clave: return {"error": f"Cultivo {cultivo} no está en el catálogo local."}
    
    req = catalogo[clave]
    resultados = []

    for _, fila in df_zona.iterrows():
        lluvia = fila['PREC_CHIRPS']
        g_root = fila['GWETROOT']
        t_min = fila['T2M_MIN']
        
        rechazos = []
        if lluvia < req['prec_min']: rechazos.append('falta lluvia')
        if g_root < req['gwet_root_min']: rechazos.append('suelo seco')
        if t_min <= req['t_min_critica']: rechazos.append('helada')
        
        veredicto = "✅ APTO" if not rechazos else f"❌ NO APTO ({', '.join(rechazos)})"
        resultados.append({
            "Mes": fila['Fecha'].strftime('%Y-%m'),
            "Lluvia_mm": round(lluvia, 1),
            "Humedad": round(g_root, 2),
            "Temp_Min": round(t_min, 1),
            "Veredicto": veredicto
        })
    
    return {"cultivo": clave, "zona": zona_limpia, "evaluacion": resultados}