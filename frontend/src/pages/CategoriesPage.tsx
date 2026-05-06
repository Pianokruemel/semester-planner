import { useState } from "react";
import { CategoryInUseError, useCreateCategory, useDeleteCategory, useCategories, useUpdateCategory } from "../hooks/useCategories";
import { usePlannerStore } from "../planner/store";

function formatRequiredCp(min: number | null, max: number | null) {
  if (min == null && max == null) {
    return "kein Sollwert";
  }

  if (min != null && max != null && min !== max) {
    return `${min}-${max} CP`;
  }

  return `${min ?? max} CP`;
}

export function CategoriesPage() {
  const { data: categories = [] } = useCategories();
  const { snapshot } = usePlannerStore();
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

  const requirementGroups = (snapshot?.requirement_groups ?? [])
    .slice()
    .sort((left, right) => left.position - right.position || left.name.localeCompare(right.name, "de"))
    .map((group) => {
      const categoryIds = new Set(group.category_ids);
      return {
        ...group,
        earned_cp:
          snapshot?.courses
            .filter((course) => course.category_id && categoryIds.has(course.category_id) && course.is_active)
            .reduce((sum, course) => sum + course.cp, 0) ?? 0
      };
    });

  return (
    <section className="page-card">
      <h2>Kategorien verwalten</h2>
      <p className="page-intro">Deine Kategorien kommen aus dem Modulhandbuch deines Studiengangs.</p>

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

      {requirementGroups.length > 0 ? (
        <>
          <h3>CP-Gruppen</h3>
          <ul className="category-list">
            {requirementGroups.map((group) => (
              <li key={group.group_key}>
                <div className="category-title">
                  <div>
                    <strong>{group.name}</strong>
                    <small>
                      {group.earned_cp} / {formatRequiredCp(group.required_cp_min, group.required_cp_max)}
                    </small>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <ul className="category-list">
        {categories.map((category) => (
          <li key={category.id}>
            <div className="category-title">
              <span className="color-dot" style={{ backgroundColor: category.color }} />
              <div>
                <strong>{category.name}</strong>
                <small>
                  {category.earned_cp ?? 0} / {formatRequiredCp(category.required_cp_min, category.required_cp_max)} ·{" "}
                  {category._count?.courses ?? 0} Kurse
                </small>
              </div>
            </div>
            <div className="button-row">
              <button type="button" onClick={() => startEdit(category)} disabled={isBusy}>
                {category.source === "curriculum" ? "Farbe ändern" : "Bearbeiten"}
              </button>
              {category.source !== "curriculum" ? (
                <button type="button" className="danger-btn" onClick={() => void onDelete(category.id)} disabled={isBusy}>
                  {isDeleting ? "Löschen..." : "Löschen"}
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
