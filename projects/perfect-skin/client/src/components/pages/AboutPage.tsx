import { About } from '@/components/home/About'

export function AboutPage() {
  return (
    <div className="bg-background">
      {/* Header */}
      <div className="container-app py-12 md:py-20">
        <h1 className="text-h3 md:text-h2 font-heading font-bold uppercase tracking-tight text-foreground mb-8">
          О компании
        </h1>

        {/* Photos Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 mb-16 md:mb-24 items-stretch">
          <img
            src="/photos/m14.png"
            alt="Косметолог"
            width={600}
            height={800}
            loading="lazy"
            className="w-full h-full object-cover rounded-media aspect-[3/4]"
          />
          <img
            src="/photos/m5.png"
            alt="Косметика Perfect Skin"
            width={600}
            height={400}
            loading="lazy"
            className="w-full h-full object-cover rounded-media aspect-[3/2]"
          />
        </div>
      </div>

      {/* Company stats */}
      <About />

      {/* Legal info */}
      <div className="container-app py-12 md:py-16 border-t border-border">
        <div className="space-y-4 text-body-sm text-muted-foreground">
          <p>
            <span className="font-semibold text-foreground">ИП Рыбко Анна Александровна</span>
            <br />
            ОГРНИП 321508100460474
          </p>
        </div>
      </div>
    </div>
  )
}
