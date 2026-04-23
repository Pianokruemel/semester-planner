import { useState } from "react";
import { CategoryInUseError, useCreateCategory, useDeleteCategory, useCategories, useUpdateCategory } from "../hooks/useCategories";

export function CategoriesPage() {
  const { data: categories = [] } = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366F1");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState("");
  const isSaving = createCategory.isPending || updateCategory.isPending;
  const isDeleting = deleteCategory.isPending;
  const isBusy = isSaving || isDeleting;

  async function onSave() {
    setErrorText("");
    if (!name.trim()) {
      setErrorText("Name darf nicht leer sein.");
      return;
    }

    try {
      if (editingId) {
        await updateCategory.mutateAsync({ id: editingId, name: name.trim(), color });
      } else {
        await createCategory.mutateAsync({ name: name.trim(), color });
      }

      setName("");
      setColor("#6366F1");
      setEditingId(null);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    }
  }

  async function onDelete(id: string) {
    try {
      await deleteCategory.mutateAsync({ id });
    } catch (error) {
      if (error instanceof CategoryInUseError) {
        const message = error.message;
        const list = error.affectedCourses.join(", ");
        const confirmText = list ? `${message}\nBetroffene Kurse: ${list}\nTrotzdem löschen?` : `${message}\nTrotzdem löschen?`;
        const confirmed = window.confirm(confirmText);

        if (confirmed) {
          try {
            await deleteCategory.mutateAsync({ id, confirm: true });
          } catch (confirmError) {
            setErrorText(confirmError instanceof Error ? confirmError.message : "Löschen fehlgeschlagen.");
          }
        }
        return;
      }

      setErrorText(error instanceof Error ? error.message : "Löschen fehlgeschlagen.");
    }
  }

  function startEdit(category: { id: string; name: string; color: string }) {
    setEditingId(category.id);
    setName(category.name);
    setColor(category.color);
  }

  return (
    <section className="page-card">
      <h2>Kategorien verwalten</h2>
      <p className="page-intro">Organisiere Kurse visuell mit eigenen Farben und klaren Kategorien.</p>

      <div className="category-form">
        <input placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} disabled={isBusy} />
        <input type="color" value={color} onChange={(event) => setColor(event.target.value)} disabled={isBusy} />
        <input value={color} onChange={(event) => setColor(event.target.value)} disabled={isBusy} />
        <button type="button" className="primary-btn" onClick={onSave} disabled={isBusy}>
          {isSaving ? "Speichern..." : editingId ? "Aktualisieren" : "Neue Kategorie"}
        </button>
        {editingId ? (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => {
              setEditingId(null);
              setName("");
              setColor("#6366F1");
            }}
          >
            Abbrechen
          </button>
        ) : null}
      </div>

      {errorText ? <p className="error-text">{errorText}</p> : null}

      <ul className="category-list">
        {categories.map((category) => (
          <li key={category.id}>
            <div className="category-title">
              <span className="color-dot" style={{ backgroundColor: category.color }} />
              <strong>{category.name}</strong>
              <small>({category._count?.courses ?? 0} Kurse)</small>
            </div>
            <div className="button-row">
              <button type="button" onClick={() => startEdit(category)} disabled={isBusy}>
                Bearbeiten
              </button>
              <button type="button" className="danger-btn" onClick={() => void onDelete(category.id)} disabled={isBusy}>
                {isDeleting ? "Löschen..." : "Löschen"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
