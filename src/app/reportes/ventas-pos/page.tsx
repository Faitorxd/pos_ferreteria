"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { TrendingUp, DollarSign, Calendar, Filter, User, Loader2 } from "lucide-react";

const supabase = createClient();

export default function ReportesPage() {
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // States para Filtros
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all"); // 'all', 'today', 'last_month'

  // Cargar Empleados una vez
  useEffect(() => {
    supabase.from('profiles').select('*').then(({ data }) => {
      if (data) setEmployees(data);
    });
  }, []);

  // Cargar Ventas con Filtros
  useEffect(() => {
    setLoading(true);
    let query = supabase.from('sales').select('*, profiles(email)').order('created_at', { ascending: false });
    
    // Aplicar Filtro de Empleado
    if (selectedEmployee !== "all") {
      query = query.eq('user_id', selectedEmployee);
    }
    
    // Aplicar Filtro de Fecha
    if (dateFilter === 'today') {
      const today = new Date().toISOString().split('T')[0];
      query = query.gte('created_at', today + 'T00:00:00Z');
    } else if (dateFilter === 'last_month') {
      const date = new Date();
      date.setMonth(date.getMonth() - 1);
      date.setDate(1); // Primer día mes pasado
      const firstDay = date.toISOString().split('T')[0];
      
      const lastDayDate = new Date();
      lastDayDate.setDate(0); // Último día (el día '0' es el ultimo día del mes anterior)
      const lastDay = lastDayDate.toISOString().split('T')[0];

      query = query.gte('created_at', firstDay + 'T00:00:00Z').lte('created_at', lastDay + 'T23:59:59Z');
    }

    query.then(({ data }) => {
      if (data) setSales(data);
      setLoading(false);
    });
  }, [selectedEmployee, dateFilter]);

  const totalRevenue = sales.reduce((sum, sale) => sum + Number(sale.total), 0);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-800">Reportes de Ventas</h1>
        <p className="text-slate-500 mt-2">Visualiza e inspecciona el historial de transacciones en esta sede.</p>
      </div>

      {/* Barra de Filtros Inteligente */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-2 text-slate-500 font-semibold px-2">
          <Filter size={20} /> FILTROS:
        </div>
        
        {/* Filtro por Empleado/Usuario */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          <User size={18} className="text-slate-400" />
          <select 
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className="bg-transparent text-sm font-semibold text-slate-700 focus:outline-none"
          >
            <option value="all">Cualquier Empleado</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.email} ({emp.role})</option>
            ))}
          </select>
        </div>

        {/* Filtro Rápido de Fecha */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-1">
          <button 
            onClick={() => setDateFilter('all')}
            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${dateFilter === 'all' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Histórico Total
          </button>
          <button 
            onClick={() => setDateFilter('today')}
            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${dateFilter === 'today' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Solo Hoy
          </button>
          <button 
            onClick={() => setDateFilter('last_month')}
            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${dateFilter === 'last_month' ? 'bg-white shadow text-purple-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Mes Pasado
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="w-14 h-14 bg-green-100 text-green-600 rounded-xl flex items-center justify-center">
            <DollarSign size={28} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500">Ingresos (Según filtros)</p>
            <h3 className="text-2xl font-black text-slate-900">
              {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(totalRevenue)}
            </h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
            <TrendingUp size={28} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500">Ventas Registradas</p>
            <h3 className="text-2xl font-black text-slate-900">{sales.length}</h3>
          </div>
        </div>
      </div>

      {/* Tabla de Resultados */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <h3 className="font-bold text-slate-700 flex items-center gap-2">
            <Calendar size={18} />
            Desglose de Operaciones
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white text-slate-500 text-sm border-b border-slate-100">
                <th className="px-6 py-4 font-semibold">ID</th>
                <th className="px-6 py-4 font-semibold">Cajero (Empleado)</th>
                <th className="px-6 py-4 font-semibold">Fecha</th>
                <th className="px-6 py-4 font-semibold">Método</th>
                <th className="px-6 py-4 font-semibold">Estado</th>
                <th className="px-6 py-4 font-semibold text-right">Total Cobrado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">Consultando base de datos...</td></tr>
              ) : sales.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">No hay ventas que coincidan con los filtros aplicados.</td></tr>
              ) : (
                sales.map(sale => (
                  <tr key={sale.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">{sale.id.slice(0, 8)}</td>
                    <td className="px-6 py-4 font-bold text-blue-600 text-sm">
                      {sale.profiles?.email || 'Desconocido'}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-700 whitespace-nowrap text-sm">
                      {new Date(sale.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 uppercase font-bold text-xs text-slate-500 tracking-wider">
                      {sale.payment_method}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full font-bold text-xs bg-green-100 text-green-800">
                        {sale.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-black text-right text-slate-900 border-l border-slate-50 bg-slate-50/50">
                      {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(Number(sale.total))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
