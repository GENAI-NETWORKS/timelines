/**
 * TailorPrintout.jsx — Portal-rendered, print-only tailor worksheet.
 * Shown via createPortal into document.body so CSS `#root{display:none}` doesn't clip it.
 *
 * Includes: Customer Name, Phone, Dates, all Particulars,
 *           Design sections (Front/Back/Sleeve) with canvas images at full size,
 *           Reference images at high quality.
 * Excludes: Price, Total, Payment.
 */
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { getItemMeta } from './ParticularRow';

const API_BASE = import.meta.env.VITE_API_URL || '';

function fmt(d) {
  try { return d ? format(new Date(d), 'dd MMM yyyy') : '—'; } catch { return '—'; }
}

/* ── Design section block (Front / Back / Sleeve) ─────────────────────── */
function DesignBlock({ label, notes, canvasImgUrl, canvasDataUrl, designImgUrl, isArya }) {
  // Use server URL if available, fall back to local data URL (saved but not uploaded yet)
  const displaySrc = canvasImgUrl
    ? (canvasImgUrl.startsWith('data:') ? canvasImgUrl : `${API_BASE}${canvasImgUrl}`)
    : canvasDataUrl || null;

  return (
    <div className="tp-design-block">
      <div className="tp-design-label">{label} Design</div>

      {/* Notes */}
      {notes ? (
        <div className="tp-design-notes">{notes}</div>
      ) : (
        <div className="tp-design-notes tp-placeholder">—</div>
      )}

      {/* Arya reference image */}
      {isArya && designImgUrl && (
        <div className="tp-img-caption">Design Reference:</div>
      )}
      {isArya && designImgUrl && (
        <img
          src={`${API_BASE}${designImgUrl}`}
          alt={`${label} design ref`}
          className="tp-design-ref-img"
        />
      )}

      {/* Canvas drawing — from server or local data URL */}
      {displaySrc ? (
        <>
          <div className="tp-img-caption">Drawn Canvas:</div>
          <img
            src={displaySrc}
            alt={`${label} canvas`}
            className="tp-canvas-img"
          />
        </>
      ) : (
        /* Empty drawing box for tailor to sketch manually */
        <div className="tp-empty-canvas">
          <span className="tp-empty-label">[ Sketch / Draw here ]</span>
        </div>
      )}
    </div>
  );
}


/* ── Main print content ─────────────────────────────────────────────────── */
export function TailorPrintContent({ order, customer }) {
  const items     = order?.items || [];
  const custName  = customer?.name  || order?.customer?.name  || '—';
  const custPhone = customer?.phone || order?.customer?.phone || '—';

  return (
    <div className="tp-wrapper">

      {/* ── Shop header ─────────────────────────────────────────────── */}
      <div className="tp-header">
        <div className="tp-shop-name">TIMELINES COSTUME DESIGNERS</div>
        <div className="tp-sheet-title">Tailor Work Sheet</div>
      </div>

      {/* ── Customer block ──────────────────────────────────────────── */}
      <table className="tp-info-table">
        <tbody>
          <tr>
            <td className="tp-label-cell">Customer Name</td>
            <td className="tp-value-cell">{custName}</td>
            <td className="tp-label-cell">Phone</td>
            <td className="tp-value-cell">{custPhone}</td>
          </tr>
          <tr>
            <td className="tp-label-cell">Order Date</td>
            <td className="tp-value-cell">{fmt(order?.orderDate)}</td>
            <td className="tp-label-cell">Delivery Date</td>
            <td className="tp-value-cell">{fmt(order?.deliveryDate)}</td>
          </tr>
        </tbody>
      </table>

      <div className="tp-divider" />
      <div className="tp-section-heading">PARTICULARS</div>

      {items.length === 0 && (
        <p className="tp-empty-msg">No particulars added.</p>
      )}

      {/* ── Per item ─────────────────────────────────────────────────── */}
      {items.map((item, idx) => {
        const meta = getItemMeta(item.itemType);
        const subs = Array.isArray(item.subItems) ? item.subItems : [];

        return (
          <div key={item.id} className="tp-item">

            {/* Item header bar */}
            <div className="tp-item-header">
              {idx + 1}.&nbsp;&nbsp;{meta.label}
              <span className="tp-qty-badge">Qty: {item.quantity}</span>
            </div>

            {/* Lining row (Design Blouse only) */}
            {meta.hasLining && (item.details?.liningSource || item.details?.liningMeter) && (
              <div className="tp-lining-row">
                <strong>Lining:</strong>{' '}
                {item.details.liningSource === 'SHOP'
                  ? 'Shop purchase (Inside)'
                  : item.details.liningSource === 'CUSTOMER'
                  ? 'Customer purchased(outside)'
                  : item.details.liningSource || ''}
                {item.details.liningMeter ? `  ·  ${item.details.liningMeter} m` : ''}
                {item.details.liningPrice  ? `  ·  ₹ (not printed)` : ''}
              </div>
            )}

            {/* Per-quantity sub-items */}
            {subs.map((sub, si) => (
              <div key={si} className="tp-subitem">
                {/* Sub-item header — only if more than 1 */}
                {item.quantity > 1 && (
                  <div className="tp-subitem-header">Item {si + 1}</div>
                )}

                {/* Basic fields row */}
                <div className="tp-fields-row">
                  {meta.hasMeter && sub.meter && (
                    <span><strong>Meter:</strong> {sub.meter} m</span>
                  )}
                  {meta.hasSource && sub.source && (
                    <span><strong>Source:</strong> {sub.source === 'SHOP' ? 'Shop purchase (Inside)' : 'Customer purchased(outside)'}</span>
                  )}
                  {meta.isSaree && sub.numberOfSarees && (
                    <span><strong>Sarees:</strong> {sub.numberOfSarees}</span>
                  )}
                  {meta.isSaree && sub.numberOfFalls && (
                    <span><strong>Falls:</strong> {sub.numberOfFalls}</span>
                  )}
                </div>

                {/* Description */}
                {sub.description && (
                  <div className="tp-field"><strong>Notes:</strong> {sub.description}</div>
                )}

                {/* Reason for Edit */}
                {sub.editReason && (
                  <div className="tp-field text-amber-700"><strong>Reason for Edit:</strong> {sub.editReason}</div>
                )}

                {/* Aari work notes */}
                {meta.isArya && sub.aryaWorkNotes && (
                  <div className="tp-field">
                    <strong>Aari Work Instructions:</strong>
                    <div className="tp-multiline">{sub.aryaWorkNotes}</div>
                  </div>
                )}

                {/* Reference image — large, high quality */}
                {sub.referenceImageUrl && (
                  <div className="tp-ref-image-block">
                    <div className="tp-img-caption">Reference Image:</div>
                    <img
                      src={`${API_BASE}${sub.referenceImageUrl}`}
                      alt="Reference"
                      className="tp-ref-img"
                    />
                  </div>
                )}

                {/* Design sections — always show Front / Back / Sleeve for design items */}
                {meta.hasDesign && (
                  <div className="tp-design-row">
                    {['front', 'back', 'sleeve'].map(section => (
                      <DesignBlock
                        key={section}
                        label={section.charAt(0).toUpperCase() + section.slice(1)}
                        notes={sub[`${section}DesignNotes`]}
                        canvasImgUrl={sub[`${section}CanvasImageUrl`]}
                        canvasDataUrl={sub[`${section}CanvasDataUrl`]}
                        designImgUrl={sub[`${section}DesignImageUrl`]}
                        isArya={meta.isArya}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}

      {/* General notes */}
      {order?.notes && (
        <div className="tp-general-notes">
          <strong>General Notes:</strong> {order.notes}
        </div>
      )}

      {/* Footer */}
      <div className="tp-footer">
        <div>Tailor Sign: _________________________________</div>
        <div>Date Completed: _______________</div>
        <div>Checked by: _____________________</div>
      </div>
    </div>
  );
}

export default function TailorPrintout({ order, customer }) {
  if (!order) return null;
  return createPortal(
    <div className="tailor-print-only">
      <TailorPrintContent order={order} customer={customer} />
    </div>,
    document.body
  );
}
