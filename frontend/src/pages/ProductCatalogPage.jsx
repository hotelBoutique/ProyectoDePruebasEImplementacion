import { useEffect, useState } from 'react';
import { getProductCategories, getProducts } from '../services/api.js';

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

export default function ProductCatalogPage({ token, showInactive = false }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

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

  return (
    <section className="rooms-page" aria-labelledby="catalog-title">
      <div className="rooms-heading">
        <div>
          <p className="eyebrow">CONSUMOS</p>
          <h1 id="catalog-title">Catálogo de productos</h1>
          <p className="intro">
            {showInactive
              ? 'Consulta los productos registrados, su precio, existencias y estado.'
              : 'Consulta los productos disponibles para registrar consumos de los huéspedes.'}
          </p>
        </div>
      </div>

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
