class MotorRotacionAgronomico:
    def __init__(self):
        # Impacto en el Nitrógeno del Suelo (kg/ha)
        self.balance_nitrogeno = {
            'Papa':     -80,  # Extractor fuerte
            'Haba':     +40,  # Fijador de nitrógeno
            'Cebada':   -30,  # Extractor moderado
            'Avena':    -20,  # Extractor ligero (buena cobertura)
            'Oca':      -50,  # Extractor moderado
            'Cebolla':  -60,  # Extractor fuerte
            'Descanso': +30   # Recuperación de materia orgánica
        }
        
        # Reglas de rotación del PTDI por zona (5 años)
        self.secuencias_ptdi = {
            "PUNA":     ["Papa", "Haba", "Papalisa", "Avena", "Descanso"],
            "PLANICIE": ["Papa", "Haba", "Cebada", "Oca", "Descanso"],
            "RIBERA":   ["Haba", "Papa", "Avena", "Oca", "Descanso"]
        }

    def evaluar_secuencia(self, nombre_estrategia, secuencia_cultivos):
        """Evalúa una secuencia de 5 años basándose en el suelo."""
        balance_n_total = 0
        penalizacion_monocultivo = 0
        detalles = []
        
        for año, cultivo in enumerate(secuencia_cultivos, start=1):
            # 1. Calcular impacto en Nitrógeno
            impacto_n = self.balance_nitrogeno.get(cultivo, 0)
            balance_n_total += impacto_n
            
            # 2. Penalización por repetir el mismo cultivo (Plagas/Suelo)
            if año > 1 and secuencia_cultivos[año-2] == cultivo:
                penalizacion_monocultivo += 3 # Castigo severo
                alerta = "⚠️ Alerta: Monocultivo detectado. Riesgo de plagas y agotamiento."
            else:
                alerta = "OK"
                
            detalles.append({
                "Año": año,
                "Cultivo": cultivo,
                "Impacto_N_kg": impacto_n,
                "Alerta": alerta
            })

        # 3. Cálculo del Índice de Salud del Suelo (ISS)
        # Base 5.0. Sumamos el balance de N (escalado) y restamos los castigos.
        score_suelo = 5.0 + (balance_n_total / 50.0) - penalizacion_monocultivo
        
        # Límites ecológicos (mínimo 1, máximo 10)
        score_final = max(1.0, min(10.0, round(score_suelo, 1)))
        
        return {
            "Estrategia": nombre_estrategia,
            "Secuencia": " -> ".join(secuencia_cultivos),
            "Balance_N_Total_kg": balance_n_total,
            "Score_Salud_Suelo": score_final,
            "Detalle_Anual": detalles
        }

    def comparar_estrategias(self, zona, cultivo_anterior):
        # 1. Definir las 3 estrategias a comparar
        # A: Monocultivo (Lo que hace el agricultor por necesidad)
        est_a = self.evaluar_secuencia("A (Monocultivo)", ["Papa", "Papa", "Papa", "Papa", "Papa"])
        
        # B: Rotación sugerida por el PTDI para su zona
        secuencia_b = self.secuencias_ptdi.get(zona, self.secuencias_ptdi["PLANICIE"])
        est_b = self.evaluar_secuencia("B (Rotación PTDI)", secuencia_b)
        
        # C: Rotación Rápida (Enfocada en Fijar Nitrógeno rápido)
        est_c = self.evaluar_secuencia("C (Recuperación Rápida)", ["Papa", "Haba", "Papa", "Haba", "Descanso"])
        
        # Ordenar estrategias por el Score de Salud del Suelo (la mejor primero)
        comparativa = sorted([est_a, est_b, est_c], key=lambda x: x["Score_Salud_Suelo"], reverse=True)
        
        return {
            "zona": zona,
            "mejor_estrategia": comparativa[0]["Estrategia"],
            "comparativa": comparativa
        }

# --- PRUEBA INTERNA ---
if __name__ == "__main__":
    motor = MotorRotacionAgronomico()
    resultado = motor.comparar_estrategias("PLANICIE", "Papa")
    
    print(f"🏆 La mejor estrategia para la Planicie es: {resultado['mejor_estrategia']}\n")
    for est in resultado['comparativa']:
        print(f"--- {est['Estrategia']} ---")
        print(f"Secuencia: {est['Secuencia']}")
        print(f"Balance de Nitrógeno: {est['Balance_N_Total_kg']} kg/ha")
        print(f"Índice de Salud del Suelo: {est['Score_Salud_Suelo']} / 10\n")