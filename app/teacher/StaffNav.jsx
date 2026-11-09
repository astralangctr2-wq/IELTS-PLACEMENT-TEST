// Page header inside the teacher area frame: title (+ count), one line of
// context, and the page's own actions on the right. Navigation lives in
// the sidebar (StaffShell).
export default function StaffNav({ title, subtitle, count, actions }) {
  return (
    <div className="ph">
      <div className="ph-t">
        <h1>{title}{count !== undefined && count !== null && <span className="ph-n">{count}</span>}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="ph-a">{actions}</div>}
    </div>
  );
}
