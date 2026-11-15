import pandas as pd

class MotorBayesiano:
    def __init__(self):
        # 1. Umbrales óptimos por cultivo (Basados en el Informe Técnico y PTDI)
        self.umbrales = {
            'Papa':    {'lluvia_min': 20, 'humedad_min': 0.55, 'helada_max': 0.0, 'prob_base': 0.75},
            'Haba':    {'lluvia_min': 20, 'humedad_min': 0.55, 'helada_max': -1.0, 'prob_base': 0.70},
            'Cebada':  {'lluvia_min': 15, 'humedad_min': 0.50, 'helada_max': -2.0, 'prob_base': 0.80},
            'Avena':   {'lluvia_min': 15, 'humedad_min': 0.50, 'helada_max': -2.0, 'prob_base': 0.85},
            'Oca':     {'lluvia_min': 15, 'humedad_min': 0.50, 'helada_max': -2.0, 'prob_base': 0.70},
            'Cebolla': {'lluvia_min': 10, 'humedad_min': 0.45, 'helada_max': 0.0, 'prob_base': 0.65}
        }

    def evaluar_siembra(self, cultivo, lluvia_chirps, gwetroot, tmin_pronostico):
        """
        Evalúa si es buen momento para sembrar usando datos de CHIRPS y NASA POWER.
        - lluvia_chirps: Lluvia acumulada en los últimos 7-10 días (mm)
        - gwetroot: Humedad radicular actual (0 a 1)
        - tmin_pronostico: Temperatura mínima pronosticada para los próximos días (°C)
        """
        if cultivo not in self.umbrales:
            return {"error": f"Cultivo '{cultivo}' no reconocido."}
        
        u = self.umbrales[cultivo]
        
        # 1. Calcular Probabilidades Condicionales
        # Probabilidad basada en Lluvia
        if lluvia_chirps >= u['lluvia_min']:
            prob_lluvia = 1.0
        else:
            prob_lluvia = lluvia_chirps / u['lluvia_min']
            
        # Probabilidad basada en Humedad del Suelo
        if gwetroot >= u['humedad_min']:
            prob_humedad = 1.0
        else:
            prob_humedad = gwetroot / u['humedad_min']
            
        # Probabilidad basada en Heladas (Si hay helada, la probabilidad se va al piso)
        if tmin_pronostico <= u['helada_max']:
            prob_helada = 0.05 # 5% de probabilidad si hay helada
        else:
            prob_helada = 1.0

        # 2. Aplicar Teorema de Bayes Simplificado (Naive Bayes)
        # P(Éxito | Datos) = P(Éxito_base) * P(Lluvia|Éxito) * P(Humedad|Éxito) * P(Helada|Éxito)
        prob_exito = u['prob_base'] * prob_lluvia * prob_humedad * prob_helada
        
        # 3. Generar Salida para el Frontend
        if prob_exito >= 0.60:
            decision = "✅ SEMBRAR"
            color = "verde"
            mensaje = f"Las condiciones son favorables para {cultivo}. La humedad y la lluvia pronosticada son adecuadas."
        elif prob_exito >= 0.40:
            decision = "🟡 PRECAUCIÓN"
            color = "amarillo"
            mensaje = f"Condiciones regulares. Si siembras {cultivo} hoy, el riesgo de pérdida es moderado. Si puedes, espera unos días."
        else:
            decision = "❌ ESPERAR"
            color = "rojo"
            mensaje = f"¡Alto riesgo! Las condiciones de sequía o helada son peligrosas para {cultivo}. Te recomendamos NO sembrar todavía."

        return {
            "cultivo": cultivo,
            "decision": decision,
            "prob_exito": round(prob_exito, 3),
            "color": color,
            "mensaje": mensaje,
            "detalles": {
                "lluvia_chirps": round(lluvia_chirps, 1),
                "prob_lluvia": round(prob_lluvia, 2),
                "prob_humedad": round(prob_humedad, 2),
                "prob_helada": round(prob_helada, 2)
            }
        }