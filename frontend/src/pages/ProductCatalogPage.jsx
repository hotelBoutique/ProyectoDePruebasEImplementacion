import { useEffect, useState } from 'react';
import { createProduct, getProductCategories, getProducts, updateProduct } from '../services/api.js';

const EMPTY_PRODUCT_FORM = {
  name: '',
  category: '',
  description: '',
  price: '',
  stock: '0',
  isActive: 'true',
};

function getErrorMessage(error, fallback) {
  return Array.isArray(error.details) && error.details.length
    ? error.details.join('. ')
    : error.message || fallback;
}

function validateProductForm(form) {
  const name = form.name.trim();
  const category = form.category.trim();
  if (!name || !category || String(form.price).trim() === '') {
    return 'Completa los datos obligatorios: nombre, categoría y precio.';
  }
  if (name.length < 2 || name.length > 100) return 'El nombre debe tener entre 2 y 100 caracteres.';
  if (category.length > 50) return 'La categoría no puede superar 50 caracteres.';
  if (form.description.trim().length > 500) return 'La descripción no puede superar 500 caracteres.';
  const price = Number(form.price);
  if (!Number.isFinite(price) || price < 0) return 'El precio debe ser un número mayor o igual a 0.';
  const stock = Number(form.stock);
  if (String(form.stock).trim() === '' || !Number.isInteger(stock) || stock < 0) {
    return 'Las existencias deben ser un número entero mayor o igual a 0.';
  }
  return '';
}

function ProductForm({ token, product, categories, onSaved, onCancel }) {
  const isEditing = Boolean(product);
  const [form, setForm] = useState(() => (product
    ? {
      name: product.name || '',
      category: product.category || '',
      description: product.description || '',
      price: String(product.price ?? ''),
      stock: String(product.stock ?? 0),
      isActive: product.isActive === false ? 'false' : 'true',
    }
    : EMPTY_PRODUCT_FORM));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setNotice(null);
    const error = validateProductForm(form);
    if (error) {
      setNotice({ tone: 'error', text: error });
      return;
    }

    const payload = {
      name: form.name.trim(),
      category: form.category.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      stock: Number(form.stock),
      isActive: form.isActive === 'true',
    };

    setSaving(true);
    try {
      const response = isEditing
        ? await updateProduct(token, product._id, payload)
        : await createProduct(token, payload);
      if (!isEditing) setForm(EMPTY_PRODUCT_FORM);
      setNotice({
        tone: 'success',
        text: response.message || (isEditing ? 'El producto se actualizó correctamente.' : 'Producto registrado correctamente.'),
      });
      onSaved?.(response.data?.product);
    } catch (saveError) {
      setNotice({
        tone: 'error',
        text: getErrorMessage(saveError, isEditing ? 'No fue posible actualizar el producto.' : 'No fue posible registrar el producto.'),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {notice && (
        <div className={`rooms-notice feedback-${notice.tone}`} role="status" aria-live="polite">
          {notice.text}
        </div>
      )}
      <form className="receptionist-form-card" onSubmit={handleSubmit} noValidate>
        <div className="receptionist-form-heading">
          <div>
            <span className="card-kicker">{isEditing ? 'ACTUALIZACIÓN DEL CATÁLOGO' : 'NUEVO PRODUCTO'}</span>
            <h2>{isEditing ? product.name : 'Datos del producto'}</h2>
            <p>El nombre, la categoría y el precio son obligatorios. El nombre no puede repetirse.</p>
          </div>
          <span className="account-role-pill">CATÁLOGO</span>
        </div>

        <div className="receptionist-form-grid">
          <label className="form-field" htmlFor="product-name">
            <span className="field-label">Nombre *</span>
            <input className="form-input" id="product-name" name="name" maxLength={100} placeholder="Ej. Agua sin gas 600 ml" value={form.name} onChange={updateField} required disabled={saving} />
          </label>
          <label className="form-field" htmlFor="product-category">
            <span className="field-label">Categoría *</span>
            <input className="form-input" id="product-category" name="category" maxLength={50} list="product-category-options" placeholder="Ej. Minibar" value={form.category} onChange={updateField} required disabled={saving} />
            <datalist id="product-category-options">
              {categories.map((category) => <option value={category} key={category} />)}
            </datalist>
          </label>
          <label className="form-field" htmlFor="product-description">
            <span className="field-label">Descripción</span>
            <textarea className="form-input room-description-input" id="product-description" name="description" maxLength={500} placeholder="Detalle opcional del producto" value={form.description} onChange={updateField} disabled={saving} />
          </label>
          <label className="form-field" htmlFor="product-price">
            <span className="field-label">Precio de venta (COP) *</span>
            <input className="form-input" id="product-price" name="price" type="number" min="0" step="any" placeholder="0" value={form.price} onChange={updateField} required disabled={saving} />
          </label>
          <label className="form-field" htmlFor="product-stock">
            <span className="field-label">Existencias *</span>
            <input className="form-input" id="product-stock" name="stock" type="number" min="0" step="1" value={form.stock} onChange={updateField} required disabled={saving} />
          </label>
          <label className="form-field" htmlFor="product-status">
            <span className="field-label">Estado</span>
            <select className="form-input" id="product-status" name="isActive" value={form.isActive} onChange={updateField} disabled={saving}>
              <option value="true">Activo (disponible para recepción)</option>
              <option value="false">Inactivo</option>
            </select>
          </label>
        </div>

        <div className="receptionist-form-footer">
          <p>Recepción solo ve los productos activos al registrar consumos.</p>
          <div className="receptionist-form-actions">
            {onCancel && (
              <button className="button-secondary" type="button" onClick={onCancel} disabled={saving}>
                {isEditing ? 'Cancelar edición' : 'Ver catálogo'}
              </button>
            )}
            <button className="button-primary" type="submit" disabled={saving}>
              {saving
                ? (isEditing ? 'Guardando cambios…' : 'Registrando producto…')
                : (isEditing ? 'Guardar cambios' : 'Registrar producto')}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}

const EMPTY_FILTERS = {
  search: '',
  category: '',
  status: '',
  inStock: '',
};

const LOW_STOCK_LIMIT = 5;

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

function stockLabel(stock) {
  if (stock === 0) return { text: 'Agotado', tone: 'inactive' };
  if (stock <= LOW_STOCK_LIMIT) return { text: `${stock} · Bajo`, tone: 'warning' };
  return { text: String(stock), tone: 'active' };
}

export default function ProductCatalogPage({
  token,
  showInactive = false,
  canManage = false,
  mode = 'list',
  onNavigate,
  createItemId,
  listItemId,
}) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [editingProduct, setEditingProduct] = useState(null);
  const [togglingId, setTogglingId] = useState('');
  const [notice, setNotice] = useState(null);
  const isCreating = canManage && mode === 'create';

  useEffect(() => {
    setEditingProduct(null);
    setNotice(null);
  }, [mode]);

  async function toggleProduct(product) {
    setTogglingId(product._id);
    setNotice(null);
    try {
      const response = await updateProduct(token, product._id, { isActive: !product.isActive });
      const updated = response.data?.product;
      if (updated) {
        setProducts((current) => current.map((item) => (item._id === updated._id ? updated : item)));
      }
      setNotice({
        tone: 'success',
        text: updated?.isActive
          ? `${product.name} vuelve a estar disponible para recepción.`
          : `${product.name} se desactivó y ya no aparece para registrar consumos.`,
      });
    } catch (error) {
      setNotice({ tone: 'error', text: getErrorMessage(error, 'No fue posible cambiar el estado del producto.') });
    } finally {
      setTogglingId('');
    }
  }

  // Se arma aquí y se devuelve después de declarar todos los hooks.
  const formView = isCreating || editingProduct ? (
      <section className="rooms-page" aria-labelledby="catalog-title">
        <div className="rooms-heading">
          <div>
            <p className="eyebrow">CONSUMOS</p>
            <h1 id="catalog-title">{editingProduct ? 'Editar producto' : 'Registrar producto'}</h1>
            <p className="intro">
              {editingProduct
                ? 'Actualiza el precio, las existencias o el estado del producto.'
                : 'Agrega un producto al catálogo para que recepción pueda cargarlo como consumo.'}
            </p>
          </div>
        </div>
        <ProductForm
          key={editingProduct?._id || 'new'}
          token={token}
          product={editingProduct}
          categories={categories}
          onSaved={(saved) => {
            if (editingProduct && saved) {
              setProducts((current) => current.map((item) => (item._id === saved._id ? saved : item)));
              setEditingProduct(null);
              setNotice({ tone: 'success', text: `${saved.name} se actualizó correctamente.` });
            }
            setReloadKey((current) => current + 1);
          }}
          onCancel={editingProduct ? () => setEditingProduct(null) : () => onNavigate?.(listItemId)}
        />
      </section>
  ) : null;

  const hasAppliedFilters = Object.values(appliedFilters).some((value) => value.trim());

  useEffect(() => {
    let isCurrent = true;
    getProductCategories(token)
      .then((response) => {
        if (isCurrent) setCategories(response.data?.categories || []);
      })
      .catch(() => {
        // Sin categorías el catálogo sigue funcionando; solo se pierde esa opción de filtro.
        if (isCurrent) setCategories([]);
      });

    return () => {
      isCurrent = false;
    };
  }, [token, reloadKey]);

  useEffect(() => {
    let isCurrent = true;
    setLoading(true);
    setLoadError('');

    getProducts(token, appliedFilters)
      .then((response) => {
        if (isCurrent) setProducts(response.data?.products || []);
      })
      .catch((error) => {
        if (isCurrent) setLoadError(error.message || 'No fue posible cargar el catálogo.');
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [token, appliedFilters, reloadKey]);

  function updateFilter(event) {
    const { name, value, type, checked } = event.target;
    setFilters((current) => ({
      ...current,
      [name]: type === 'checkbox' ? (checked ? 'true' : '') : value,
    }));
  }

  function applyFilters(event) {
    event.preventDefault();
    setAppliedFilters({ ...filters });
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
  }

  if (formView) return formView;

  return (
    <section className="rooms-page" aria-labelledby="catalog-title">
      <div className="rooms-heading">
        <div>
          <p className="eyebrow">CONSUMOS</p>
          <h1 id="catalog-title">Catálogo de productos</h1>
          <p className="intro">
            {canManage
              ? 'Consulta, actualiza o desactiva los productos del catálogo.'
              : showInactive
                ? 'Consulta los productos registrados, su precio, existencias y estado.'
                : 'Consulta los productos disponibles para registrar consumos de los huéspedes.'}
          </p>
        </div>
        {canManage && createItemId && (
          <button className="button-primary rooms-create-action" type="button" onClick={() => onNavigate?.(createItemId)}>
            <span aria-hidden="true">＋</span> Registrar producto
          </button>
        )}
      </div>

      {notice && (
        <div className={`rooms-notice feedback-${notice.tone}`} role="status" aria-live="polite">
          {notice.text}
        </div>
      )}

      <section className="receptionist-list-card" aria-label="Catálogo de productos">
        <div className="receptionist-list-heading">
          <div>
            <span className="card-kicker">INVENTARIO</span>
            <h2>Productos</h2>
          </div>
          <button
            className="button-secondary receptionist-refresh"
            type="button"
            onClick={() => setReloadKey((current) => current + 1)}
            disabled={loading}
          >
            {loading ? 'Cargando…' : 'Actualizar catálogo'}
          </button>
        </div>

        <form className="rooms-filters catalog-filters" onSubmit={applyFilters} noValidate aria-label="Filtrar productos">
          <label className="form-field" htmlFor="catalog-search">
            <span className="field-label">Buscar por nombre</span>
            <input
              className="form-input"
              id="catalog-search"
              name="search"
              type="search"
              maxLength={100}
              placeholder="Ej. agua"
              value={filters.search}
              onChange={updateFilter}
            />
          </label>

          <label className="form-field" htmlFor="catalog-category">
            <span className="field-label">Categoría</span>
            <select
              className="form-input"
              id="catalog-category"
              name="category"
              value={filters.category}
              onChange={updateFilter}
            >
              <option value="">Todas</option>
              {categories.map((category) => (
                <option value={category} key={category}>{category}</option>
              ))}
            </select>
          </label>

          {showInactive && (
            <label className="form-field" htmlFor="catalog-status">
              <span className="field-label">Estado</span>
              <select
                className="form-input"
                id="catalog-status"
                name="status"
                value={filters.status}
                onChange={updateFilter}
              >
                <option value="">Todos</option>
                <option value="activo">Activos</option>
                <option value="inactivo">Inactivos</option>
              </select>
            </label>
          )}

          <label className="catalog-stock-toggle" htmlFor="catalog-in-stock">
            <input
              id="catalog-in-stock"
              name="inStock"
              type="checkbox"
              checked={filters.inStock === 'true'}
              onChange={updateFilter}
            />
            <span>Solo con existencias</span>
          </label>

          <div className="rooms-filters-actions">
            <button className="button-primary" type="submit" disabled={loading}>Filtrar</button>
            <button
              className="button-secondary"
              type="button"
              onClick={clearFilters}
              disabled={loading || (!hasAppliedFilters && !Object.values(filters).some((value) => value.trim()))}
            >
              Limpiar
            </button>
          </div>
        </form>

        {!loading && !loadError && products.length > 0 && (
          <p className="rooms-filters-summary" role="status">
            {products.length === 1 ? '1 producto' : `${products.length} productos`}
            {hasAppliedFilters ? ' coinciden con los filtros.' : ' en el catálogo.'}
          </p>
        )}

        {loading ? (
          <div className="receptionist-empty-state" role="status">Cargando catálogo…</div>
        ) : loadError ? (
          <div className="receptionist-empty-state">
            <strong>No fue posible cargar el catálogo</strong>
            <p>{loadError}</p>
          </div>
        ) : products.length === 0 && hasAppliedFilters ? (
          <div className="receptionist-empty-state">
            <strong>Ningún producto coincide</strong>
            <p>Prueba con otra búsqueda o limpia los filtros para ver todo el catálogo.</p>
            <button className="button-secondary" type="button" onClick={clearFilters}>
              Limpiar filtros
            </button>
          </div>
        ) : products.length === 0 ? (
          <div className="receptionist-empty-state">
            <strong>Aún no hay productos</strong>
            <p>
              {showInactive
                ? 'Registra productos para que recepción pueda cargarlos como consumos.'
                : 'Todavía no hay productos activos en el catálogo.'}
            </p>
          </div>
        ) : (
          <div className="receptionist-table-wrap">
            <table className="receptionist-table rooms-table catalog-table">
              <thead>
                <tr>
                  <th scope="col">Producto</th>
                  <th scope="col">Categoría</th>
                  <th scope="col">Precio</th>
                  <th scope="col">Existencias</th>
                  {showInactive && <th scope="col">Estado</th>}
                  {canManage && <th scope="col"><span className="sr-only">Acciones</span></th>}
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const stock = stockLabel(product.stock);
                  return (
                    <tr key={product._id}>
                      <td>
                        <strong>{product.name}</strong>
                        {product.description && <span className="room-description">{product.description}</span>}
                      </td>
                      <td>{product.category}</td>
                      <td>{formatCurrency(product.price)}</td>
                      <td>
                        <span className={`receptionist-status receptionist-status-${stock.tone}`}>
                          <span aria-hidden="true" />
                          {stock.text}
                        </span>
                      </td>
                      {showInactive && (
                        <td>
                          <span className={`receptionist-status${product.isActive ? ' receptionist-status-active' : ' receptionist-status-inactive'}`}>
                            <span aria-hidden="true" />
                            {product.isActive ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                      )}
                      {canManage && (
                        <td className="receptionist-action-cell">
                          <div className="receptionist-actions">
                            <button
                              className="button-secondary receptionist-status-action receptionist-edit-action"
                              type="button"
                              onClick={() => { setNotice(null); setEditingProduct(product); }}
                              disabled={Boolean(togglingId)}
                            >
                              Editar
                            </button>
                            <button
                              className={`receptionist-status-action${product.isActive ? ' receptionist-deactivate-action' : ''}`}
                              type="button"
                              onClick={() => toggleProduct(product)}
                              disabled={Boolean(togglingId)}
                            >
                              {togglingId === product._id
                                ? 'Guardando…'
                                : product.isActive ? 'Desactivar' : 'Activar'}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
