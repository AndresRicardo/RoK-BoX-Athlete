import { useState } from 'react';
import { Dumbbell, ShieldCheck, Zap, AlertCircle } from 'lucide-react';
import useAuthStore from '../stores/authStore';

export default function Login() {
  const { signInWithGoogle } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      await signInWithGoogle();
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Error al iniciar sesión con Google');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0C] flex flex-col justify-between p-6 relative overflow-hidden select-none">
      {/* Glow ambiental */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-[#FFC815]/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Header / Brand */}
      <div className="flex flex-col items-center pt-8 z-10">
        <div className="w-20 h-20 rounded-3xl bg-[#1C1C1E] border border-white/10 p-3 shadow-2xl flex items-center justify-center mb-4">
          <img src="/favicon.svg" alt="RöK BoX" className="w-full h-full object-contain" />
        </div>
        <h1 className="text-3xl font-black tracking-tight text-white">
          RöK<span className="text-[#FFC815]">BoX</span>
        </h1>
        <span className="text-xs font-black tracking-widest text-[#A0A0A5] uppercase mt-1">
          Athlete Platform v2
        </span>
      </div>

      {/* Feature Highlights */}
      <div className="flex flex-col gap-3 max-w-sm mx-auto w-full z-10 my-8">
        <div className="p-3.5 rounded-2xl bg-[#1C1C1E]/80 border border-white/5 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#FFC815]/15 text-[#FFC815] shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-extrabold text-white">Tus Récords & PRs</h4>
            <p className="text-[11px] text-[#A0A0A5]">Histórico de fuerza, benchmarks y skills gimnásticas.</p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#1C1C1E]/80 border border-white/5 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-extrabold text-white">Membresía & Huellero</h4>
            <p className="text-[11px] text-[#A0A0A5]">Sincronización de acceso biométrico con HikCentral.</p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#1C1C1E]/80 border border-white/5 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 shrink-0">
            <Dumbbell className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-extrabold text-white">Tienda & Deudas</h4>
            <p className="text-[11px] text-[#A0A0A5]">Control total de tus suplementos e implementos del box.</p>
          </div>
        </div>
      </div>

      {/* CTA Button */}
      <div className="max-w-sm mx-auto w-full z-10 pb-4">
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-xs text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleLogin}
          disabled={loading}
          className="w-full py-4 px-6 rounded-2xl bg-white hover:bg-gray-100 text-black font-black text-sm flex items-center justify-center gap-3 shadow-xl tap-bounce disabled:opacity-60 transition-transform"
        >
          {loading ? (
            <span>Conectando con Google...</span>
          ) : (
            <>
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continuar con Google</span>
            </>
          )}
        </button>

        <p className="text-[11px] text-[#A0A0A5] text-center mt-4">
          Acceso exclusivo para la comunidad de atletas RöK BoX.
        </p>
      </div>
    </div>
  );
}
