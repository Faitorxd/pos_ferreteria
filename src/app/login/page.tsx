"use client";

import { useActionState } from "react";
import { login } from "./actions";
import { LockKeyhole, Mail, Store } from "lucide-react";

export default function LoginPage() {
  const [errorMessage, formAction, isPending] = useActionState(
    async (prevState: any, formData: FormData) => {
      const res = await login(formData);
      if (res?.error) return res.error;
      return null;
    },
    null
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center w-full px-4">
      <div className="max-w-md w-full p-10 bg-white shadow-2xl rounded-3xl border border-slate-100">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-100 text-blue-600 mb-6">
            <Store size={32} />
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Acceso al Sistema</h2>
          <p className="mt-3 text-slate-500 font-medium">POS Ferretería V1</p>
        </div>

        <form action={formAction} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Correo Electrónico
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-slate-400" />
              </div>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800 transition-all font-medium"
                placeholder="usuario@ferreteria.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Contraseña
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <LockKeyhole className="h-5 w-5 text-slate-400" />
              </div>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800 transition-all font-medium"
                placeholder="••••••••"
              />
            </div>
          </div>

          {errorMessage && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-semibold text-center mt-2 animate-in fade-in">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-lg shadow-blue-500/30 text-lg font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isPending ? "Validando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
