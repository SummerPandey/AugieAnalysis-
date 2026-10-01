/**
 * The one status badge for a data source — used by the coverage panel and the
 * import step so the icon, word and badge style can never drift apart.
 * Status is always an icon plus a word, never colour alone.
 */
import type { ComponentType } from "react"
import { IconCheck, IconClock, IconInfo, IconWarning } from "./icons"
import { STATUS_LABEL, type SourceStatus } from "./projectStatus"

const STATUS_UI: Record<SourceStatus, { badge: string; Icon: ComponentType<{ size?: number }> }> = {
  live: { badge: "badge badge-success", Icon: IconCheck },
  partial: { badge: "badge badge-warning", Icon: IconWarning },
  reference: { badge: "badge badge-info", Icon: IconInfo },
  pending: { badge: "badge", Icon: IconClock },
}

export function SourceStatusBadge({ status }: { status: SourceStatus }) {
  const { badge, Icon } = STATUS_UI[status]
  return (
    <span className={badge}>
      <Icon size={12} />
      {STATUS_LABEL[status]}
    </span>
  )
}
