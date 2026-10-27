// BMG (Friday): slider v2 styles + Telegram next to WhatsApp on the front page
add_action('wp_head', function () {
    $css = <<<'BMGCSS'
/* BMG slider v2: full-width banners (only slides with bmg-slide images) */
.slider-new-main .slick-slide:has(img[src*="bmg-slide"]),.main-slider:has(img[src*="bmg-slide"]){height:auto!important;padding-right:0!important}
.main-slider__product:has(img[src*="bmg-slide"]){position:relative;display:block;width:100%!important;height:min(calc(100vw * .4375),640px)!important;padding:0!important;overflow:hidden}
.main-slider__product:has(img[src*="bmg-slide"]) .product__decorative-block{position:absolute;inset:0;margin:0;min-width:0;width:100%!important;height:100%!important;top:0;left:0;background:none;border-radius:0}
.main-slider__product:has(img[src*="bmg-slide"]) .product__img--decorative{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:85% 80%}
.main-slider__product:has(img[src*="bmg-slide"]) .product__info{position:absolute;z-index:2;top:0;left:0;width:48%;height:100%;max-height:none;margin:0;padding:0 0 0 7%;background:none;display:flex;flex-direction:column;justify-content:center}
.main-slider__product:has(img[src*="bmg-slide"]) .product__info--text{max-width:none}
.main-slider__product:has(img[src*="bmg-slide"]) .product__name{max-width:none;margin:0 0 32px;padding:0;font-size:clamp(28px,3.4vw,56px);line-height:1.15}
.main-slider__product:has(img[src*="bmg-slide"]) .product__info picture{display:none}
@media (max-width:743px){
.main-slider__product:has(img[src*="bmg-slide"]){height:calc((100vw - 16px) * 1.2857)!important;width:calc(100vw - 16px)!important;margin:0!important}
.main-slider__product:has(img[src*="bmg-slide"]) .product__decorative-block{display:none}
.main-slider__product:has(img[src*="bmg-slide"]) .product__info{position:absolute;inset:0;width:100%;height:100%;padding:28px 20px 0;justify-content:flex-start}
.main-slider__product:has(img[src*="bmg-slide"]) .product__info picture{display:block;position:absolute;inset:0;z-index:-1}
.main-slider__product:has(img[src*="bmg-slide"]) .product__img--preview{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;top:0;left:0;right:0}
.main-slider__product:has(img[src*="bmg-slide"]) .product__name{font-size:clamp(24px,7.4vw,34px);margin-bottom:16px}
}
BMGCSS;
    echo '<style id="bmg-slider-v2">' . $css . '</style>';
}, 99);

add_action('template_redirect', function () {
    if (!is_front_page()) {
        return;
    }
    ob_start(function ($html) {
        return str_replace('WhatsApp: <a href="https://wa.me/+79891812454"', 'WhatsApp / Telegram: <a href="https://wa.me/+79891812454"', $html);
    });
});
