<?php
add_filter('acf/load_field/key=field_63ca52036f995', function ($field) {
    $field['allow_null'] = 1;
    $field['placeholder'] = 'Не указан';
    $field['default_value'] = '';
    return $field;
});
add_action('wp_head', function () {
    echo '<style id="bmg-unrated-reviews">.main-reviews__item:has(.bmg-review-no-rating) .reviews-clients__grade,.main-reviews__item:has(.bmg-review-no-rating) .main-reviews__grade{display:none!important}</style>';
}, 21);
add_filter('paginate_links', function ($link) {
    return preg_replace('~(/reviews)/+(\d+)/?(?=\?|$)~', '$1/page/$2/', $link);
});
