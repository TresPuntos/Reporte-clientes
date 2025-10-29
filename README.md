# Reporte Clientes - Toggl

Aplicación web moderna para generar reportes de tiempo profesional desde múltiples cuentas de Toggl Track con UI/UX moderno con dark mode.

## ✨ Características

### 🎨 UI/UX Moderna
- **Dark Mode** con next-themes y tema automático
- **Componentes shadcn/ui** basados en Radix UI
- **Iconos Lucide React** para una mejor experiencia visual
- **Gráficas con Recharts** para visualización de datos
- **Diseño responsive** con Tailwind CSS
- **Tokens CSS** para temas personalizables
- **Microinteracciones** con animaciones sutiles

## Características Funcionales

### 1. Panel de Administración
- Conecta múltiples cuentas de Toggl
- Verifica que las cuentas funcionen correctamente
- Almacena las credenciales de forma segura en el navegador

### 2. Generador de Reportes
- Selecciona entre las cuentas de Toggl conectadas
- Filtra por:
  - Cliente
  - Proyecto
  - Tag
- Añade múltiples configuraciones para reportes combinados
- Visualiza los resultados en:
  - **Resumen**: Tabla agrupada por tareas con totales y porcentajes
  - **Detalle**: Tabla completa con todas las entradas de tiempo

### 3. Generación de Reporte HTML
- Genera automáticamente un archivo HTML para el cliente
- Incluye resumen y detalle de todas las entradas
- Diseño profesional y responsive
- Listo para compartir con clientes

## Instalación

1. Instala las dependencias:
```bash
npm install
```

2. Inicia el servidor de desarrollo:
```bash
npm run dev
```

3. Abre [http://localhost:3000](http://localhost:3000) en tu navegador

## Uso

### Obtener tu API Token de Toggl

1. Ve a tu [perfil de Toggl](https://track.toggl.com/profile)
2. Copia tu API Token
3. Pégala en el Panel de Administración de la aplicación

### Crear un Reporte

1. Ve a la pestaña "Generador de Reportes"
2. Selecciona las fechas del período
3. Añade una o más configuraciones (cuentas + filtros)
4. Haz clic en "Actualizar Reporte"
5. Visualiza los resultados
6. Haz clic en "Generar Reporte HTML para Cliente" para descargar el archivo

## Tecnologías

- **Next.js 16**: Framework de React
- **TypeScript**: Tipado estático
- **Tailwind CSS**: Estilos con variables CSS para dark mode
- **Toggl Track API v9**: API de Toggl
- **Recharts**: Gráficas de datos
- **shadcn/ui**: Componentes UI modernos
- **next-themes**: Dark mode
- **Lucide React**: Iconos
- **date-fns**: Manipulación de fechas

## Estructura del Proyecto

```
├── app/
│   ├── api/
│   │   ├── toggl/route.ts          # Proxy de API
│   │   └── reports/[publicUrl]/route.ts
│   ├── report/[publicUrl]/         # Dashboard de reportes
│   ├── globals.css                 # Estilos con tokens CSS
│   ├── layout.tsx                  # Layout con ThemeProvider
│   └── page.tsx                    # Página principal
├── components/
│   ├── ui/                         # Componentes shadcn/ui
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── tabs.tsx
│   │   └── ...
│   ├── theme-toggle.tsx            # Toggle de dark mode
│   ├── theme-provider.tsx          # Provider de temas
│   ├── api-key-manager.tsx         # Gestor de cuentas
│   ├── client-report-generator.tsx # Generador de reportes
│   └── client-report-dashboard.tsx  # Dashboard moderno
└── lib/
    ├── types.ts                    # Tipos de TypeScript
    ├── utils.ts                     # Utilidades cn()
    ├── toggl.ts                     # Funciones de API
    └── report-calculations.ts       # Cálculos de reportes
```

## Arquitectura

### Proxy de API

Esta aplicación utiliza un proxy de API para evitar problemas de CORS. Cuando el frontend necesita datos de Toggl:

1. Envía una petición POST a `/api/toggl`
2. El servidor recibe la petición y llama a la API de Toggl
3. La respuesta se retransmite de vuelta al cliente

Esto permite que la aplicación funcione completamente desde el navegador sin problemas de seguridad.

## Seguridad

- Las API Keys se almacenan localmente en el navegador (localStorage)
- Nunca se envían a servidores externos
- Todas las llamadas a Toggl pasan por el proxy del servidor

## Licencia

ISC

