"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, BookOpen, FileText, LayoutList } from 'lucide-react';

export default function MenusPage() {
  const [nombreMenu, setNombreMenu] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [menusGuardados, setMenusGuardados] = useState([]); 

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        
        {/* CABECERA */}
        <div className="flex items-center justify-between mb-8">
          <Link 
            href="/dashboard" 
            className="flex items-center text-gray-500 hover:text-black transition-colors font-medium"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Volver al Panel
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* COLUMNA IZQUIERDA: FORMULARIO NUEVO MENU */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-6">
                <LayoutList className="w-5 h-5 text-blue-600" />
                <h2 className="font-bold text-gray-800">Crear Nuevo Menú</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Nombre del Menú</label>
                  <input 
                    type="text"
                    value={nombreMenu}
                    onChange={(e) => setNombreMenu(e.target.value)}
                    placeholder="Ej: Menú Fin de Semana"
                    className="w-full p-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Descripción</label>
                  <textarea 
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="Ej: Selección de platos de temporada..."
                    className="w-full p-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm h-24 resize-none"
                  />
                </div>

                <Link 
                  href={{
                    pathname: '/dashboard/menus/nuevo',
                    query: { nombre: nombreMenu, desc: descripcion } // Pasamos los datos a la siguiente página
                  }}
                  className={`w-full py-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all ${
                    nombreMenu 
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-100' 
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Plus className="w-5 h-5" />
                  Siguiente: Agregar Platos
                </Link>
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA: LISTADO */}
          <div className="lg:col-span-2">
            <h1 className="text-2xl font-black text-gray-900 mb-6">Tus Menús Guardados</h1>
            
            {menusGuardados.length === 0 ? (
              <div className="bg-white border-2 border-dashed border-gray-200 rounded-3xl p-12 text-center">
                <div className="bg-blue-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="w-8 h-8 text-blue-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-800">Aún no tienes menús</h3>
                <p className="text-gray-500 text-sm mt-1 max-w-xs mx-auto">
                  Utiliza el formulario de la izquierda para organizar tus platos por categorías o temporadas.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {/* Aquí listaremos los menús que vengan de Supabase */}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}