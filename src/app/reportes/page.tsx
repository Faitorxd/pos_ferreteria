"use client";

import Link from "next/link";
import { ChevronDown, Star, HelpCircle, FileText, Lock } from "lucide-react";

export default function ReportHubPage() {
  const sections = [
    {
      title: "Ventas",
      columns: [
        {
          title: "Ventas",
          items: [
            { name: "Ventas Siigo POS", link: "/reportes/ventas-pos", ready: true },
            { name: "Ventas por vendedor", link: "#", ready: false },
            { name: "Ventas por cliente", link: "#", ready: false },
          ]
        },
        {
          title: "Facturas y Recibos",
          items: [
             { name: "Listado de facturas electrónicas", link: "#", ready: false },
             { name: "Recibos de caja detallado", link: "#", ready: false },
          ]
        }
      ]
    },
    {
      title: "Clientes y Proveedores",
      columns: [
        {
          title: "Cuánto me deben (Clientes)",
          items: [
            { name: "Cuentas por cobrar general por cliente", link: "/cartera", ready: true },
            { name: "Cuentas por cobrar detallada por documento", link: "#", ready: false },
          ]
        },
        {
          title: "Cuánto estoy debiendo (Proveedores)",
          items: [
            { name: "Cuentas por pagar general por proveedor", link: "/cuentas-pagar", ready: true },
            { name: "Movimiento de cuentas por pagar", link: "#", ready: false },
          ]
        }
      ]
    },
    {
      title: "Compras y Gastos",
      columns: [
        {
          title: "Adquisiciones",
          items: [
            { name: "Compras consolidadas por proveedor", link: "/reportes/compras-proveedor", ready: true },
            { name: "Compras por producto", link: "#", ready: false },
          ]
        },
        {
          title: "Egresos",
          items: [
            { name: "Movimiento de gastos de Caja Menor", link: "/caja", ready: true },
          ]
        }
      ]
    },
    {
      title: "Productos y Servicios",
      columns: [
        {
          title: "Saldos y movimientos",
          items: [
            { name: "Saldos de inventario (Kardex Físico y Costeo)", link: "/reportes/inventario-saldos", ready: true },
            { name: "Saldos de productos bajo mínimo", link: "#", ready: false },
          ]
        },
        {
          title: "Rentabilidad",
          items: [
            { name: "Rentabilidad por producto / Utilidad", link: "#", ready: false }
          ]
        }
      ]
    },
    {
      title: "Contables y Financieros",
      columns: [
        {
          title: "Tributario / Libros oficiales",
          items: [
            { name: "Libro de inventarios y balance", link: "#", ready: false },
            { name: "Libro oficial de compras", link: "#", ready: false },
            { name: "Libro Mayor y Balance", link: "#", ready: false },
          ]
        },
        {
          title: "Financieros",
          items: [
            { name: "Estado de situación financiera (Balance)", link: "#", ready: false },
            { name: "Estado de resultado integral (PyG)", link: "#", ready: false },
          ]
        }
      ]
    }
  ];

  return (
    <div className="p-8 h-full overflow-y-auto bg-slate-50/50">
      
      <div className="mb-8 flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
             <FileText className="text-blue-500 w-8 h-8" />
             Reportes 
             <span className="bg-blue-100 text-blue-700 text-sm font-bold px-3 py-1 rounded-full uppercase tracking-wider ml-2 shadow-sm border border-blue-200">
                PRO
             </span>
          </h1>
          <p className="text-slate-500 mt-2 font-medium">Centro de Inteligencia de Negocios y Contabilidad Corporativa.</p>
        </div>
        <div className="relative w-72">
           <input type="text" placeholder="Buscar por:" className="w-full border-2 border-slate-200 rounded-lg pr-12 pl-4 py-2 focus:border-blue-500 outline-none" />
           <div className="absolute right-0 top-0 bottom-0 bg-blue-500 w-12 rounded-r-lg flex items-center justify-center cursor-pointer">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
           </div>
        </div>
      </div>

      <div className="space-y-6">
        {sections.map((section, idx) => (
          <div key={idx} className="bg-white rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-200 overflow-hidden break-inside-avoid">
            {/* Header / Acordeón falso abierto */}
            <div className="p-5 border-b border-slate-100 flex items-center gap-2 cursor-pointer hover:bg-slate-50 transition-colors">
               <ChevronDown className="w-5 h-5 text-blue-500" />
               <h2 className="text-lg font-black text-slate-800 tracking-tight">{section.title}</h2>
            </div>

            {/* Content grid */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
               {section.columns.map((col, colIdx) => (
                 <div key={colIdx}>
                    <h3 className="font-bold text-slate-700 mb-4">{col.title}</h3>
                    <ul className="space-y-4">
                       {col.items.map((item, idxi) => (
                         <li key={idxi} className="flex items-center justify-between group">
                            {item.ready ? (
                               <Link href={item.link} className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors flex-1 cursor-pointer">
                                  {item.name}
                               </Link>
                            ) : (
                               <span className="text-sm font-medium text-slate-400 flex items-center gap-2 flex-1 cursor-not-allowed">
                                  {item.name}
                                  <Lock className="w-3 h-3 text-slate-300 inline" />
                               </span>
                            )}
                            
                            <div className="flex flex-shrink-0 items-center gap-3 ml-4 opacity-70 group-hover:opacity-100 transition-opacity">
                               <button className="text-blue-400 hover:text-blue-600 transition-colors tooltip-trigger" title="Ayuda sobre este reporte">
                                  <HelpCircle className="w-4 h-4" />
                               </button>
                               <button className="text-slate-300 hover:text-blue-500 transition-colors">
                                  <Star className="w-4 h-4" />
                               </button>
                            </div>
                         </li>
                       ))}
                    </ul>
                 </div>
               ))}
            </div>
          </div>
        ))}
      </div>
      
    </div>
  );
}
