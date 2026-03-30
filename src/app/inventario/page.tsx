"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Search, Plus, Package, Edit, Trash2, X, UploadCloud, Link as LinkIcon, Loader2 } from "lucide-react";

const supabase = createClient();

export default function InventarioPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados del Modal de Nuevo/Editar Producto
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Datos del nuevo producto
  const [newProduct, setNewProduct] = useState({
    name: "",
    barcode: "",
    price: "",
    stock: "",
  });

  // Gestión de la Imagen (URL o Storage)
  const [imageType, setImageType] = useState<"url" | "file">("url");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);

  const fetchInventory = () => {
    supabase.from('products').select('*')
      .then(({ data }) => {
        if (data) setProducts(data);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const handleDeleteProduct = async (id: string, name: string) => {
    if (!window.confirm(`¿Estás seguro de eliminar "${name}"? Esta acción no se puede deshacer.`)) return;
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      fetchInventory();
    } catch (err: any) {
      alert("Error al eliminar: " + err.message);
    }
  };

  const openEditModal = (p: any) => {
    setEditingId(p.id);
    setNewProduct({
      name: p.name,
      barcode: p.barcode || "",
      price: p.price.toString(),
      stock: p.stock.toString(),
    });
    if (p.image_url) {
      setImageType('url');
      setImageUrl(p.image_url);
    } else {
      setImageType('url');
      setImageUrl('');
    }
    setImageFile(null);
    setIsModalOpen(true);
  };

  const openNewModal = () => {
    setEditingId(null);
    setNewProduct({ name: "", barcode: "", price: "", stock: "" });
    setImageUrl("");
    setImageFile(null);
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      let finalImageUrl = imageType === "url" ? (imageUrl || null) : null;

      // 1. Si eligió subir archivo nativo al Storage
      if (imageType === "file" && imageFile) {
        // Limpiamos el nombre para que no tenga espacios ni caracteres RAROS
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        // Subir al Bucket
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, imageFile);
          
        if (uploadError) {
          throw new Error("No se pudo subir la imagen al Storage. ¿Activaste las políticas públicas del Bucket product-images?");
        }

        // Obtener la URL Pública que genera Supabase
        const { data: publicUrlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);
          
        finalImageUrl = publicUrlData.publicUrl;
      }

      // 2. Insertar o Actualizar Información en la BD
      const productPayload = {
        name: newProduct.name,
        barcode: newProduct.barcode || null,
        price: Number(newProduct.price),
        stock: Number(newProduct.stock),
        image_url: finalImageUrl
      };

      let dbError;
      if (editingId) {
        // Modo Edición: UPDATE
        // Si no subió foto nueva ni pegó enlace nuevo, mantenemos el payload pero si `finalImageUrl` es nulo tras elegir 'url', borramos la imagen
        const { error } = await supabase.from('products').update(productPayload).eq('id', editingId);
        dbError = error;
      } else {
        // Modo Nuevo: INSERT
        const { error } = await supabase.from('products').insert([productPayload]);
        dbError = error;
      }

      if (dbError) throw dbError;

      alert(editingId ? "¡Producto Actualizado Exitosamente!" : "¡Producto Creado Exitosamente!");
      
      // Cerrar Modal, limpiar formulario y recargar lista
      setIsModalOpen(false);
      setNewProduct({ name: "", barcode: "", price: "", stock: "" });
      setImageUrl("");
      setImageFile(null);
      fetchInventory();

    } catch (error: any) {
      alert(error.message || "Error al guardar el producto");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-8 h-full relative">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-800">Inventario</h1>
          <p className="text-slate-500 mt-2">Gestiona los productos disponibles en la ferretería.</p>
        </div>
        <button 
          onClick={openNewModal}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95"
        >
          <Plus size={20} />
          Nuevo Producto
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Buscar en inventario..." 
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 shadow-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-200">
                <th className="px-6 py-4 font-semibold">Producto</th>
                <th className="px-6 py-4 font-semibold">Código</th>
                <th className="px-6 py-4 font-semibold">Stock</th>
                <th className="px-6 py-4 font-semibold">Precio / U</th>
                <th className="px-6 py-4 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-500">Cargando datos...</td></tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-400">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    No hay productos registrados. Haz clic en "Nuevo Producto" para empezar.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-800 flex items-center gap-3">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-10 h-10 object-contain p-1 rounded shadow-sm border border-slate-200 bg-white" />
                      ) : (
                        <div className="w-10 h-10 bg-slate-100 rounded border border-slate-200 flex items-center justify-center text-xs text-slate-400">Sm/Img</div>
                      )}
                      {p.name}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-sm font-mono bg-slate-50 rounded-md w-max m-3">{p.barcode || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-bold text-xs ${p.stock < 10 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                        {p.stock} U.
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-800 font-bold">
                      {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(p.price)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 text-slate-400">
                        <button onClick={() => openEditModal(p)} className="hover:text-blue-600 transition-colors"><Edit size={18} /></button>
                        <button onClick={() => handleDeleteProduct(p.id, p.name)} className="hover:text-red-600 transition-colors"><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* OVERLAY Y MODAL DE NUEVO PRODUCTO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col">
            
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Package className="text-blue-600" /> {editingId ? "Editar Artículo" : "Registrar Nuevo Artículo"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-slate-600 mb-1">Nombre del Producto *</label>
                  <input required placeholder="Ej. Martillo de Acero 16oz" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-slate-600 mb-1">Código de Barras (Opcional)</label>
                  <input placeholder="Apunta con la pistola aquí..." value={newProduct.barcode} onChange={e => setNewProduct({...newProduct, barcode: e.target.value})} className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1">Precio Unitario (COP) *</label>
                  <input 
                    required 
                    type="text" 
                    placeholder="10.000" 
                    value={newProduct.price ? new Intl.NumberFormat('es-CO').format(Number(newProduct.price)) : ""} 
                    onChange={e => {
                      const rawValue = e.target.value.replace(/\D/g, "");
                      setNewProduct({...newProduct, price: rawValue});
                    }} 
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium" 
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1">Unidades en Existencia *</label>
                  <input required type="number" min="0" placeholder="10" value={newProduct.stock} onChange={e => setNewProduct({...newProduct, stock: e.target.value})} className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
              </div>

              {/* GESTIÓN DE LA IMAGEN */}
              <div className="mt-6 border border-slate-200 rounded-xl p-4 bg-slate-50">
                <label className="block text-sm font-bold text-slate-700 mb-3">Foto del Producto</label>
                
                {/* Tabs / Switcher */}
                <div className="flex bg-slate-200/50 p-1 rounded-lg mb-4">
                  <button type="button" onClick={() => setImageType('url')} className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-sm font-semibold rounded-md transition-all ${imageType === 'url' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
                    <LinkIcon size={16} /> Enlace de Internet
                  </button>
                  <button type="button" onClick={() => setImageType('file')} className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-sm font-semibold rounded-md transition-all ${imageType === 'file' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
                    <UploadCloud size={16} /> Subir de la PC
                  </button>
                </div>

                {imageType === 'url' ? (
                  <div>
                    <input type="url" placeholder="https://ejemplo.com/imagen.jpg" value={imageUrl} onChange={e => setImageUrl(e.target.value)} className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm" />
                    <p className="text-xs text-slate-400 mt-2">Pega la dirección de una imagen pública (Google Images, Amazon, etc).</p>
                  </div>
                ) : (
                  <div>
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-white hover:bg-slate-50 transition-colors">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <UploadCloud className="w-8 h-8 mb-2 text-slate-400" />
                        <p className="text-sm text-slate-500 font-semibold">{imageFile ? imageFile.name : "Haz clic para buscar imagen"}</p>
                        <p className="text-xs text-slate-400">SVG, PNG, JPG (MÁX. 2MB)</p>
                      </div>
                      <input type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
                    </label>
                  </div>
                )}
              </div>
              
              <div className="mt-8 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-lg font-bold text-slate-500 hover:bg-slate-100 transition-colors">
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-bold shadow-md transition-all flex items-center gap-2"
                >
                  {isSaving ? <Loader2 size={18} className="animate-spin" /> : 'Guardar en Base de Datos'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
}
