import { adminApi } from '../../lib/adminApi'
import { useAdminData, formatNumber } from '../../lib/adminHelpers'

export default function AdminDevices() {
  const { data, error, loading } = useAdminData(adminApi.devices)
  const platforms = (data?.platform ?? {}) as Record<string, number>
  const browsers = (data?.browser ?? {}) as Record<string, number>

  return (
    <div className="ad-page">
      <div className="ad-page-head">
        <div>
          <h1>Devices & Platform</h1>
          <p>Device and browser breakdown</p>
        </div>
      </div>

      {error && <div className="ad-alert">{error}</div>}
      {loading && <div className="ad-empty">Loading device data...</div>}

      {!loading && !error && data && (
        <>
          <div className="ad-card">
            <div className="ad-card-title"><h3>Platform</h3><span>{formatNumber(data.total_sessions as number)} focus sessions tracked</span></div>
            <div className="ad-bars">
              {Object.entries(platforms).map(([k, v]) => (
                <div className="ad-bar-row" key={k}>
                  <span>{k[0].toUpperCase() + k.slice(1)}</span>
                  <div className="ad-bar-track">
                    <i className="ad-bar-fill" style={{ width: `${v}%` }} />
                  </div>
                  <span className="ad-bar-num">{v}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="ad-card">
            <div className="ad-card-title"><h3>Browser</h3><span>Share</span></div>
            <div className="ad-bars">
              {Object.entries(browsers).map(([k, v]) => (
                <div className="ad-bar-row" key={k}>
                  <span>{k}</span>
                  <div className="ad-bar-track">
                    <i className="ad-bar-fill mint" style={{ width: `${v}%` }} />
                  </div>
                  <span className="ad-bar-num">{v}%</span>
                </div>
              ))}
            </div>
          </div>

          {data.note && (
            <div className="ad-empty">
              <strong>Note:</strong> {data.note as string}
            </div>
          )}
        </>
      )}
    </div>
  )
}