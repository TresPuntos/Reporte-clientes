'use client';

import { useState } from 'react';
import type { ReportTag } from '@/lib/report-types';
import { Plus, X, CheckCircle, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

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
    const trimmedName = newTagName.trim();
    if (!trimmedName) {
      console.warn('Intento de añadir tag vacío');
      return;
    }

    const tagExists = reportTags.some(t => t.name.toLowerCase() === trimmedName.toLowerCase());
    if (tagExists) {
      alert('Este tag ya existe en el reporte');
      return;
    }

    const newTag: ReportTag = {
      name: trimmedName,
      status: activeTag ? 'completed' : 'active', // Si ya hay un tag activo, este será completado
    };

    console.log('Añadiendo nuevo tag:', newTag);
    console.log('Tags actuales:', reportTags);
    
    // Si no hay tag activo, hacer este el activo
    if (!activeTag) {
      console.log('Estableciendo tag activo:', newTag.name);
      onActiveTagChange(newTag.name);
    }

    const updatedTags = [...reportTags, newTag];
    console.log('Tags actualizados:', updatedTags);
    onTagsChange(updatedTags);
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
    const updatedTags: ReportTag[] = reportTags.map(tag => ({
      ...tag,
      status: (tag.name === tagName ? 'active' : 'completed') as 'active' | 'completed',
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
      const updatedTags: ReportTag[] = reportTags.map(t =>
        t.name === tagName ? { ...t, status: 'completed' as const } : t
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
        <div>
          <label className="block text-sm font-medium">Tags del Reporte</label>
          <p className="text-xs text-muted-foreground mt-1">
            Usa este módulo para gestionar los tags del reporte: puedes añadir nuevos, marcarlos
            como activos (el tag de trabajo actual) o completarlos cuando dejen de estar en uso.
          </p>
        </div>
        {!showAddTag && (
          <Button
            onClick={() => setShowAddTag(true)}
            size="sm"
            className="gap-1"
          >
            <Plus className="w-3 h-3" />
            Añadir Tag
          </Button>
        )}
      </div>

      {/* Lista de tags del reporte */}
      <div className="space-y-2">
        {reportTags.map(tag => (
          <div
            key={tag.name}
            className="flex items-center gap-3 p-3 bg-card rounded-md border border-border hover:bg-muted/50 transition-colors"
          >
            <button
              onClick={() => handleToggleStatus(tag.name)}
              className="flex items-center gap-2 flex-1 text-left min-w-0"
            >
              {tag.status === 'active' ? (
                <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )}
              <span className={`text-sm truncate ${tag.status === 'active' ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                {tag.name}
              </span>
            </button>
            <div className="flex items-center gap-2 flex-shrink-0">
              {tag.status === 'active' && (
                <Badge variant="default">
                  Activo
                </Badge>
              )}
              {tag.status === 'completed' && (
                <Badge variant="secondary">
                  Completado
                </Badge>
              )}
              <button
                onClick={() => handleRemoveTag(tag.name)}
                className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                aria-label="Eliminar tag"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {reportTags.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No hay tags configurados en el reporte</p>
        )}
      </div>

      {/* Formulario para añadir tag */}
      {showAddTag && (
        <div className="p-3 bg-muted/20 rounded-md border border-border">
          <div className="flex gap-2 mb-2">
            <Input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              placeholder="Nombre del tag"
              className="flex-1"
              list="available-tags-list"
            />
            <Button
              onClick={handleAddTag}
              size="sm"
            >
              Añadir
            </Button>
            <Button
              onClick={() => {
                setShowAddTag(false);
                setNewTagName('');
              }}
              variant="secondary"
              size="sm"
            >
              Cancelar
            </Button>
          </div>

          {/* Sugerencias de tags de Toggl */}
          {unusedTags.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <p className="mb-1">Tags disponibles de Toggl:</p>
              <div className="flex flex-wrap gap-1">
                {unusedTags.slice(0, 10).map(tag => (
                  <Button
                    key={tag}
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-6 px-2 py-0 text-xs"
                    onClick={() => setNewTagName(tag)}
                  >
                    {tag}
                  </Button>
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

