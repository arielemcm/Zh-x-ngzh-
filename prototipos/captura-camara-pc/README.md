# Captura con la cámara de la computadora

Aplicación local para encender la cámara de la computadora, tomar una fotografía, previsualizarla y guardarla en `uploads/`.

## Ejecutar

Desde la raíz del proyecto:

```powershell
env\Scripts\python.exe prototipos\captura-camara-pc\server.py
```

Después abre:

```text
http://127.0.0.1:8001
```

El navegador solicitará permiso para utilizar la cámara. Después de aceptarlo:

1. Pulsa **Tomar fotografía**.
2. Revisa la vista previa.
3. Pulsa **Guardar fotografía** o **Tomar otra**.
4. Las fotografías guardadas aparecen en la lista y dentro de `uploads/`.

No necesita celular, QR, conexión Wi-Fi ni archivos BAT.
