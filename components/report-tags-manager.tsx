'use client';

import { useState } from 'react';
import type { ReportTag } from '@/lib/report-types';
import { Plus, X, CheckCircle, Circle } from 'lucide-react';

interface ReportTagsManagerProps {
  reportTags: ReportTag[];
  activeTag?: string;
  availableTags: string[]; // Tags disponibles de Toggl
  onTagsChange: (tags: ReportTag[]) => void;
  onActiveTagChange: (tagName: string | undefined) => void;
}

export default function ReportTagsManager({
  reportTags,
  activeTag,
  availableTags,
  onTagsChange,
  onActiveTagChange,
}: ReportTagsManagerProps) {
  const [newTagName, setNewTagName] = useState('');
  const [showAddTag, setShowAddTag] = useState(false);

  const handleAddTag = () => {
    if (!newTagName.trim()) return;

    const tagExists = reportTags.some(t => t.name.toLowerCase() === newTagName.trim().toLowerCase());
    if (tagExists) {
      alert('Este tag ya existe en el reporte');
      return;
    }

    const newTag: ReportTag = {
      name: newTagName.trim(),
      status: activeTag ? 'completed' : 'active', // Si ya hay un tag activo, este será completado
    };

    // Si no hay tag activo, hacer este el activo
    if (!activeTag) {
      onActiveTagChange(newTag.name);
    }

    onTagsChange([...reportTags, newTag]);
    setNewTagName('');
    setShowAddTag(false);
  };

  const handleRemoveTag = (tagName: string) => {
    if (activeTag === tagName) {
      // Si se elimina el tag activo, no hay tag activo
      onActiveTagChange(undefined);
    }
    onTagsChange(reportTags.filter(t => t.name !== tagName));
  };

  const handleSetActive = (tagName: string) => {
    // Marcar el tag actual como activo y los demás como completados
    const updatedTags = reportTags.map(tag => ({
      ...tag,
      status: tag.name === tagName ? 'active' : 'completed',
    }));

    onTagsChange(updatedTags);
    onActiveTagChange(tagName);
  };

  const handleToggleStatus = (tagName: string) => {
    const tag = reportTags.find(t => t.name === tagName);
    if (!tag) return;

    if (tag.status === 'active') {
      // Si se desactiva el tag activo, quitar el tag activo
      if (activeTag === tagName) {
        onActiveTagChange(undefined);
      }
      const updatedTags = reportTags.map(t =>
        t.name === tagName ? { ...t, status: 'completed' } : t
      );
      onTagsChange(updatedTags);
    } else {
      // Activar este tag (marcar los demás como completados)
      handleSetActive(tagName);
    }
  };

  // Tags disponibles que no están en el reporte
  const unusedTags = availableTags.filter(
    tag => !reportTags.some(rt => rt.name.toLowerCase() === tag.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium">Tags del Reporte</label>
        {!showAddTag && (
          <button
            onClick={() => setShowAddTag(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <Plus className="w-3 h-3" />
            Añadir Tag
          </button>
        )}
      </div>

      {/* Lista de tags del reporte */}
      <div className="space-y-2">
        {reportTags.map(tag => (
          <div
            key={tag.name}
            className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200"
          >
            <button
              onClick={() => handleToggleStatus(tag.name)}
              className="flex items-center gap-2 flex-1 text-left"
            >
              {tag.status === 'active' ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <Circle className="w-4 h-4 text-gray-400" />
              )}
              <span className={`text-sm ${tag.status === 'active' ? 'font-semibold text-green-700' : 'text-gray-600'}`}>
                {tag.name}
              </span>
              {tag.status === 'active' && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                  Activo
                </span>
              )}
              {tag.status === 'completed' && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                  Completado
                </span>
              )}
            </button>
            <button
              onClick={() => handleRemoveTag(tag.name)}
              className="p-1 text-red-600 hover:text-red-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}

        {reportTags.length === 0 && (
          <p className="text-xs text-gray-500 italic">No hay tags configurados en el reporte</p>
        )}
      </div>

      {/* Formulario para añadir tag */}
      {showAddTag && (
        <div className="p-3 bg-blue-50 rounded border border-blue-200">
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleAddTag();
                }
              }}
              placeholder="Nombre del tag"
              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
              list="available-tags-list"
            />
            <button
              onClick={handleAddTag}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              Añadir
            </button>
            <button
              onClick={() => {
                setShowAddTag(false);
                setNewTagName('');
              }}
              className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400"
            >
              Cancelar
            </button>
          </div>

          {/* Sugerencias de tags de Toggl */}
          {unusedTags.length > 0 && (
            <div className="text-xs text-gray-600">
              <p className="mb-1">Tags disponibles de Toggl:</p>
              <div className="flex flex-wrap gap-1">
                {unusedTags.slice(0, 10).map(tag => (
                  <button
                    key={tag}
                    onClick={() => {
                      setNewTagName(tag);
                    }}
                    className="px-2 py-0.5 bg-white border border-gray-300 rounded text-xs hover:bg-gray-50"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          <datalist id="available-tags-list">
            {unusedTags.map(tag => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
        </div>
      )}
    </div>
  );
}

