export default function Pagination({ offset, limit, total, onChange, disabled = false }) {
  return <div className="list-pagination">
    <button type="button" className="btn btn-secondary" disabled={disabled || offset === 0}
      onClick={() => onChange(Math.max(0, offset - limit))}>Previous</button>
    <span>{total === 0 ? "0 results" : `${offset + 1}–${Math.min(offset + limit, total)} of ${total}`}</span>
    <button type="button" className="btn btn-secondary" disabled={disabled || offset + limit >= total}
      onClick={() => onChange(offset + limit)}>Next</button>
  </div>;
}
