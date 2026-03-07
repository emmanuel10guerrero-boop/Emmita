import React from 'react';
import { Utensils, ClipboardList, BarChart3, UserCircle, ArrowRight, Globe, Boxes } from 'lucide-react';
import Link from 'next/link';

const Dashboard = () => {
  const modulos = [
    {
      id: 1,
      titulo: "MENÚS",
      descripcion: "Gestiona tus platos, fotos y análisis de alérgenos.",
      icono: <Utensils className="w-8 h-8 text-blue-600" />,
      link: "/dashboard/menus",
      color: "bg-blue-50"
    },
    {
      id: 2,
      titulo: "ÓRDENES",
      descripcion: "Mira los pedidos entrantes y el estado de las mesas.",
      icono: <ClipboardList className="w-8 h-8 text-green-600" />,
      link: "/dashboard/ordenes",
      color: "bg-green-50"
    },
    {
      id: 3,
      titulo: "REPORTES",
      descripcion: "Estadísticas de ventas y platos más buscados.",
      icono: <BarChart3 className="w-8 h-8 text-purple-600" />,
      link: "/dashboard/reportes",
      color: "bg-purple-50"
    },
    {
      id: 4,
      titulo: "PERFIL",
      descripcion: "Configura los datos de tu local y horarios.",
      icono: <UserCircle className="w-8 h-8 text-orange-600" />,
      link: "/dashboard/perfil",
      color: "bg-orange-50"
    },
    {
      id: 5,
      titulo: "PÁGINA PÚBLICA",
      descripcion: "Administra enlaces públicos y QR visibles para clientes.",
      icono: <Globe className="w-8 h-8 text-cyan-600" />,
      link: "/dashboard/publica",
      color: "bg-cyan-50"
    },
    {
      id: 6,
      titulo: "STOCK",
      descripcion: "Organiza secciones e ingredientes para reutilizarlos en tus items.",
      icono: <Boxes className="w-8 h-8 text-emerald-600" />,
      link: "/dashboard/stock",
      color: "bg-emerald-50"
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <header className="max-w-6xl mx-auto mb-12">
        <h1 className="text-4xl font-black text-gray-900">Panel de Control</h1>
        <p className="text-gray-500 font-medium">Bienvenido de nuevo. ¿Qué quieres gestionar hoy?</p>
      </header>

      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        {modulos.map((modulo) => (
          <Link key={modulo.id} href={modulo.link}>
            <div className="group bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className={`p-4 ${modulo.color} rounded-xl group-hover:scale-110 transition-transform`}>
                  {modulo.icono}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800 tracking-tight">{modulo.titulo}</h2>
                  <p className="text-sm text-gray-500 max-w-[200px]">{modulo.descripcion}</p>
                </div>
              </div>
              <ArrowRight className="w-6 h-6 text-gray-300 group-hover:text-blue-600 group-hover:translate-x-2 transition-all" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
// PAGE_INFO: Panel principal del dashboard con accesos a módulos.
