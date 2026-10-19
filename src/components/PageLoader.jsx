export default function PageLoader() {
  return (
    <div className="min-h-screen bg-[#0A0A0C] flex flex-col items-center justify-center p-6 text-center">
      <div className="relative w-16 h-16 flex items-center justify-center mb-4">
        <div className="absolute inset-0 rounded-full border-4 border-[#292929]"></div>
        <div className="absolute inset-0 rounded-full border-4 border-[#FFC815] border-t-transparent animate-spin"></div>
        <img src="/favicon.svg" alt="RöK BoX" className="w-8 h-8 object-contain" />
      </div>
      <p className="text-sm font-semibold tracking-wider text-[#A0A0A5] uppercase">
        Cargando RöK BoX...
      </p>
    </div>
  );
}
