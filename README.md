# RöK BoX Athlete v2

PWA de alto rendimiento para atletas y staff de RöK BoX CrossFit. Diseñada 100% Mobile-First para pantallas de teléfonos inteligentes.

Este repositorio forma parte del ecosistema unificado **RöK BoX Platform**. Para lineamientos de arquitectura, migraciones globales y diseño de base de datos, consultar el repositorio central: [`d:\rokbox-platform`](https://github.com/AndresRicardo/rokbox-platform).

## Características Principales

1. **Dashboard Atlético & Membresías (HikCentral v2)**:
   - Visualización de vigencia de membresía (Al día, Por vencer, En mora) mediante la vista reactiva `membership_status`.
   - Conteo regresivo de días restantes.
   - Estado del torniquete/huellero (Acceso biométrico habilitado o bloqueado).
   - Solicitud de verificación y vinculación de cédula (`member_link_requests`).
2. **Control Financiero & Deudas v2 (COP $)**:
   - Desglose de implementos, suplementos, bebidas y cuotas mediante `debt_summary`, `debts`, `debt_items` y `debt_payments`.
   - Historial de abonos en tiempo real y recálculo automático de saldos vía triggers.
3. **Módulo de Entrenamiento**:
   - Registro y edición de PRs (fuerza, halterofilia, gimnásticos, cardio).
   - WODs y Benchmarks oficiales (Girls, Heroes, Clásicos con modalidades RX / Scaled).
   - Gráficas evolutivas de progreso con Recharts.
   - Catálogo de habilidades (Skills) desbloqueables.
4. **Comunidad & Red Social**:
   - Feed social en tiempo real (Likes, comentarios y notificaciones).
   - Tablero de líderes (Leaderboard) por movimiento y WOD.
   - Buscador de atletas con perfiles públicos y sistema `@handle`.
5. **Logros & Medallas**:
   - Sistema de insignias por hitos deportivos (Bronce, Plata, Oro).
6. **Panel POS para Staff / Coaches**:
   - Búsqueda instantánea de miembros por nombre o cédula.
   - Carga rápida de suplementos e implementos a miembros.
   - Registro de abonos sobre ítems de deuda.
   - Renovación de membresías vía RPC `renew_membership`.
   - Aprobación / rechazo de solicitudes de vinculación de cédula vía RPC `review_member_link`.
7. **Sincronización con Torniquete HikCentral**:
   - Agente desacoplado en `d:\rokbox-platform\bridge` que sincroniza periódicamente hacia la API OpenAPI de HikCentral Access Control.

---

## Stack Tecnológico

- **Frontend**: React 19 + Vite 6 + Tailwind CSS v4 + Lucide React + Zustand 5
- **Routing**: React Router 7 (Arquitectura mobile-first de 5 pestañas)
- **Gráficas**: Recharts 2.15 (optimizado para pantallas táctiles)
- **Base de Datos & Auth**: Supabase (Google OAuth + PostgreSQL con RLS + Realtime)
- **PWA**: vite-plugin-pwa + Workbox (Standalone, offline caching, soporte para notch)

---

## Comandos

```bash
npm run dev      # Servidor de desarrollo móvil local (http://localhost:5173)
npm run build    # Compilación para producción (dist/)
npm run preview  # Previsualizar build de producción
npm run icons    # Regenerar iconos PWA desde isotipo limpio.svg
```

---

## Variables de Entorno (.env)

```env
VITE_SUPABASE_URL=https://qsqrnfgcozvznkbdyozs.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_7iCTpltHInnukzgVSpP3vc_-a2Op859
VITE_VAPID_PUBLIC_KEY=BHbsQN1dMOrI9IV2AoGpDwKfcY9aE4VO2kS09fOk9qNOJmJyEDpc7sXoIrGeLY-Icwnce_X9WEiovtmgqoC3nYM
```

---

## Paleta de Colores de Marca (RöK BoX)

- **Primary**: `#FFC815` (Amarillo oro RöK BoX)
- **Background**: `#0A0A0C` (Dark Mode puro de alto contraste)
- **Surface**: `#1C1C1E` (Gris oscuro moderno estilo tarjeta iOS)
- **Surface 2**: `#292929`
- **Muted**: `#38383A` / `#585858`
- **Text**: `#FFFFFF` / `#A0A0A5`
- **Success**: `#10B981` (Al día / Acceso Huella OK)
- **Warning**: `#F59E0B` (Vence pronto / Deuda)
- **Danger**: `#EF4444` (En mora / Acceso Bloqueado)
