/**
 * TailorPrintout.jsx — Portal-rendered, print-only tailor worksheet.
 * Shown via createPortal into document.body so CSS `#root{display:none}` doesn't clip it.
 *
 * showPrices=false (default / print) — excludes all price columns
 * showPrices=true  (preview)         — includes prices & totals
 */
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { getItemMeta } from './ParticularRow';

const API_BASE = import.meta.env.VITE_API_URL || '';

function fmt(d) {
  try { return d ? format(new Date(d), 'dd MMM yyyy') : '—'; } catch { return '—'; }
}

/* ── Measurement grid ────────────────────────────────────────────────────── */
const MEAS_FIELDS = [
  { key: 'SL',         label: 'SL' },
  { key: 'SA',         label: 'SA' },
  { key: 'ARM',        label: 'ARM' },
  { key: 'BACK_L',     label: 'Back L' },
  { key: 'HIP',        label: 'HIP' },
  { key: 'PAKKA',      label: 'PAKKA' },
  { key: 'SHOULDER',   label: 'Shoulder' },
  { key: 'BACKNECK',   label: 'Back Neck' },
  { key: 'CHEST',      label: 'CHEST' },
  { key: 'FRONT_NECK', label: 'Front Neck' },
  { key: 'FRONT_LEN',  label: 'Front Len' },
];

function MeasurementGrid({ sub }) {
  const filled = MEAS_FIELDS.filter(f => sub[`measurement_${f.key}`]);
  if (!filled.length) return null;
  return (
    <div className="tp-meas-grid">
      {filled.map(f => (
        <div key={f.key} className="tp-meas-cell">
          <span className="tp-meas-label">{f.label}</span>
          <span className="tp-meas-val">{sub[`measurement_${f.key}`]}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Design section block (Front / Back / Sleeve) ─────────────────────── */
function DesignBlock({ label, notes, canvasImgUrl, canvasDataUrl, designImgUrl, isArya }) {
  const displaySrc = canvasImgUrl
    ? (canvasImgUrl.startsWith('data:') ? canvasImgUrl : `${API_BASE}${canvasImgUrl}`)
    : canvasDataUrl || null;

  return (
    <div className="tp-design-block">
      <div className="tp-design-label">{label} Design</div>

      {notes ? (
        <div className="tp-design-notes">{notes}</div>
      ) : (
        <div className="tp-design-notes tp-placeholder">—</div>
      )}

      {isArya && designImgUrl && (
        <>
          <div className="tp-img-caption">Design Reference:</div>
          <img src={`${API_BASE}${designImgUrl}`} alt={`${label} design ref`} className="tp-design-ref-img" />
        </>
      )}

      {displaySrc ? (
        <>
          <div className="tp-img-caption">Drawn Canvas:</div>
          <img src={displaySrc} alt={`${label} canvas`} className="tp-canvas-img" />
        </>
      ) : (
        <div className="tp-empty-canvas">
          <span className="tp-empty-label">[ Sketch / Draw here ]</span>
        </div>
      )}
    </div>
  );
}


/* ── Main print content ─────────────────────────────────────────────────── */
export function TailorPrintContent({ order, customer, showPrices = false }) {
  const items     = order?.items || [];
  const custName  = customer?.name  || order?.customer?.name  || '—';
  const custPhone = customer?.phone || order?.customer?.phone || '—';

  let grandTotal = 0;

  return (
    <div className="tp-wrapper">

      {/* ── Fixed header for every printed page ─────────────────────── */}
      <div className="tp-page-header">
        {custName} | ID: {order?.customer?.customerId || order?.customerId || '—'}
      </div>

      {/* ── Shop header ─────────────────────────────────────────────── */}
      <div className="tp-header">
        <div className="tp-shop-name">TIMELINES COSTUME DESIGNERS</div>
        <div className="tp-sheet-title">{showPrices ? 'Customer Order Preview' : 'Tailor Work Sheet'}</div>
      </div>

      {/* ── Customer block ──────────────────────────────────────────── */}
      <table className="tp-info-table">
        <tbody>
          <tr>
            <td className="tp-label-cell">Customer Name</td>
            <td className="tp-value-cell" colSpan={3}>{custName}</td>
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
        const rawSubs = Array.isArray(item.subItems) ? item.subItems : [];
        const subs = rawSubs.slice(0, Math.max(1, item.quantity || 1));
        const meta = getItemMeta(item.itemType);

        // Running total for preview
        let itemTotal = 0;
        if (showPrices) {
          subs.forEach(sub => {
            itemTotal += parseFloat(sub.price || 0);
            if (sub.source !== 'CUSTOMER') itemTotal += parseFloat(sub.sourcePrice || 0);
            if (meta.hasLining && sub.liningSource !== 'CUSTOMER') {
              itemTotal += parseFloat(sub.liningPrice || 0);
            }
          });
          grandTotal += itemTotal;
        }

        return (
          <div key={item.id} className="tp-item">

            {/* Item header bar */}
            <div className="tp-item-header">
              {idx + 1}.&nbsp;&nbsp;{meta.label}
              <span className="tp-qty-badge">Qty: {item.quantity}</span>
              {showPrices && itemTotal > 0 && (
                <span className="tp-price-badge">₹ {itemTotal.toFixed(0)}</span>
              )}
            </div>



            {/* Bag row */}
            {(item.details?.bagNo || item.details?.bagColour) && (
              <div className="tp-lining-row" style={{ marginTop: '2px' }}>
                <strong>Bag Details:</strong> {item.details?.bagNo || '—'} {item.details?.bagColour ? `(${item.details.bagColour})` : ''}
              </div>
            )}

            {/* Blouse Type & Notes (item-level) */}
            {meta.hasBlouseType && item.details?.blouseType && (
              <div className="tp-lining-row" style={{ marginTop: '2px' }}>
                <strong>Blouse Type:</strong> {item.details.blouseType === 'MEASUREMENT' ? 'Measurement Blouse' : 'Sample Blouse'}
                {item.details?.blouseNotes && <>&nbsp;·&nbsp;<strong>Notes:</strong> {item.details.blouseNotes}</>}
              </div>
            )}

            {/* Sample Blouse Image */}
            {item.details?.blouseType === 'SAMPLE' && item.details?.sampleBlouseImageUrl && (
              <div className="tp-ref-image-block">
                <div className="tp-img-caption">Sample Blouse Image:</div>
                <img
                  src={`${API_BASE}${item.details.sampleBlouseImageUrl}`}
                  alt="Sample Blouse"
                  className="tp-ref-img"
                />
              </div>
            )}

            {/* Per-quantity sub-items */}
            {subs.map((sub, si) => (
              <div key={si} className="tp-subitem">

                {/* Sub-item header — only if more than 1 */}
                {item.quantity > 1 && (
                  <div className="tp-subitem-header">Item {si + 1}</div>
                )}

                {/* Meter / Source / Price row */}
                {(meta.hasMeter || meta.hasSource || meta.isSaree || (showPrices && sub.price)) && (
                  <div className="tp-fields-row">
                    {meta.hasMeter && sub.meter && (
                      <span><strong>Meter:</strong> {sub.meter} m</span>
                    )}
                    {meta.hasSource && sub.source && (
                      <span><strong>Source:</strong> {sub.source === 'SHOP' ? 'Shop purchase (Inside)' : 'Customer purchased (outside)'}</span>
                    )}
                    {showPrices && meta.hasSource && sub.source !== 'CUSTOMER' && sub.sourcePrice && (
                      <span><strong>Src Price:</strong> ₹ {sub.sourcePrice}</span>
                    )}
                    {showPrices && sub.price && (
                      <span><strong>Stitching:</strong> ₹ {sub.price}</span>
                    )}
                    {meta.isSaree && sub.numberOfSarees && (
                      <span><strong>Sarees:</strong> {sub.numberOfSarees}</span>
                    )}
                    {meta.isSaree && sub.numberOfFalls && (
                      <span><strong>Falls:</strong> {sub.numberOfFalls}</span>
                    )}
                    {meta.isSaree && sub.sareeColour && (
                      <span><strong>Colour:</strong> {sub.sareeColour}</span>
                    )}
                  </div>
                )}

                {/* Lining row */}
                {meta.hasLining && (sub.liningSource || sub.liningMeter) && (
                  <div className="tp-fields-row" style={{ marginTop: '4px' }}>
                    <span><strong>Lining:</strong>{' '}
                    {sub.liningSource === 'SHOP'
                      ? 'Shop purchase (Inside)'
                      : sub.liningSource === 'CUSTOMER'
                      ? 'Customer purchased (outside)'
                      : sub.liningSource || ''}</span>
                    {sub.liningMeter ? <span><strong>Lining Meter:</strong> {sub.liningMeter} m</span> : ''}
                    {showPrices && sub.liningPrice ? <span><strong>Lining Price:</strong> ₹ {sub.liningPrice}</span> : ''}
                  </div>
                )}

                {/* Measurements grid */}
                {meta.hasMeasurements && <MeasurementGrid sub={sub} />}

                {/* Description */}
                {sub.description && (
                  <div className="tp-field"><strong>Notes:</strong> {sub.description}</div>
                )}

                {/* Reason for Edit */}
                {sub.editReason && (
                  <div className="tp-field tp-edit-reason"><strong>Reason for Edit:</strong> {sub.editReason}</div>
                )}

                {/* Aari work notes */}
                {meta.isArya && sub.aryaWorkNotes && (
                  <div className="tp-field">
                    <strong>Aari Work Instructions:</strong>
                    <div className="tp-multiline">{sub.aryaWorkNotes}</div>
                  </div>
                )}

                {/* Reference image */}
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

                {/* Design sections — Front / Back / Sleeve */}
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

      {/* Grand total (preview only) */}
      {showPrices && grandTotal > 0 && (
        <div className="tp-grand-total">
          <strong>Grand Total: ₹ {grandTotal.toFixed(0)}</strong>
        </div>
      )}

      {/* General notes */}
      {order?.notes && (
        <div className="tp-general-notes">
          <strong>General Notes:</strong> {order.notes}
        </div>
      )}

      {/* Footer (print only) */}
      {!showPrices && (
        <div className="tp-footer">
          <div>Tailor Sign: _________________________________</div>
          <div>Date Completed: _______________</div>
          <div>Checked by: _____________________</div>
        </div>
      )}
    </div>
  );
}

export default function TailorPrintout({ order, customer }) {
  if (!order) return null;
  return createPortal(
    <div className="tailor-print-only">
      <TailorPrintContent order={order} customer={customer} showPrices={false} />
    </div>,
    document.body
  );
}
