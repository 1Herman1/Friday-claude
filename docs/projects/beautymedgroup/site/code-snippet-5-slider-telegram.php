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
/* BMG slider v2: arrows on both sides, dots at the bottom edge */
.main-slider:has(img[src*="bmg-slide"]){padding-top:0!important}
.main-slider:has(img[src*="bmg-slide"]) .main-slider__btns{position:absolute;z-index:3;top:0;left:0;right:0;width:auto;height:min(calc(100vw * .4375),640px);display:flex;flex-direction:row;justify-content:space-between;align-items:center;gap:0;padding:0 18px;pointer-events:none}
.main-slider:has(img[src*="bmg-slide"]) .main-slider__btn{pointer-events:auto;width:52px;height:52px;border-radius:50%;background-color:rgba(255,255,255,.72);background-size:26px 13px;box-shadow:0 4px 18px rgba(150,90,100,.12);transition:background-color .2s ease}
.main-slider:has(img[src*="bmg-slide"]) .main-slider__btn:hover{background-color:#fff}
.slider-new-main:has(img[src*="bmg-slide"]) .slick-dots{bottom:16px!important}
.slider-new-main:has(img[src*="bmg-slide"]) .slick-dots li button{background:rgba(255,255,255,.85);box-shadow:0 0 0 1px rgba(240,133,151,.45)}
.slider-new-main:has(img[src*="bmg-slide"]) .slick-dots li.slick-active button{background:#F08597;box-shadow:none}
.main-slider__product:has(img[src*="bmg-slide"]) .product__info{padding-left:max(7%,96px)}
@media (max-width:743px){.slider-new-main:has(img[src*="bmg-slide"]) .slick-dots{bottom:12px!important}.main-slider:has(img[src*="bmg-slide"]) .main-slider__btns{display:none!important}.main-slider__product:has(img[src*="bmg-slide"]) .product__info{padding-left:20px}}
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
