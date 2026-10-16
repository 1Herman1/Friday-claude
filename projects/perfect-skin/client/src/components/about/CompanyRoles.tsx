import { COMPANY_ROLES } from './care-data'
import { LABEL } from './classes'

export function CompanyRoles() {
  return (
    <dl className="border-t border-border">
      {COMPANY_ROLES.map((role) => (
        <div
          key={role.label}
          className="grid grid-cols-1 gap-y-1 border-b border-border py-4 sm:grid-cols-[11rem_1fr] sm:gap-x-8"
        >
          <dt className={`${LABEL} text-muted-foreground sm:pt-1`}>{role.label}</dt>
          <dd className="text-body text-foreground">
            {role.value}
            {role.note && (
              <span className="mt-1 block text-body-sm text-muted-foreground">{role.note}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}
