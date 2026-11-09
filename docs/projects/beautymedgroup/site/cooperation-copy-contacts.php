<?php
add_action('wp_footer', function () {
    if (!is_page(963)) {
        return;
    }
    ?>
<script id="bmg-copy-contacts-script">
(function () {
    'use strict';
    var block = document.getElementById('bmg-cooperation-contacts');
    if (!block) return;
    var status = block.querySelector('[role="status"]');
    function fallback(value) {
        var input = document.createElement('textarea');
        input.value = value;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        var copied = document.execCommand('copy');
        input.remove();
        if (!copied) throw new Error('Clipboard unavailable');
    }
    async function copy(target) {
        var value = target.getAttribute('data-bmg-copy');
        try {
            try {
                if (!navigator.clipboard || !window.isSecureContext) throw new Error('Use fallback');
                await navigator.clipboard.writeText(value);
            } catch (error) {
                fallback(value);
            }
            status.textContent = 'Скопировано: ' + value;
        } catch (error) {
            status.textContent = 'Выделите контакт и скопируйте его вручную.';
        }
    }
    block.addEventListener('click', function (event) {
        var target = event.target.closest('[data-bmg-copy]');
        if (target && block.contains(target)) copy(target);
    });
    block.addEventListener('keydown', function (event) {
        var target = event.target.closest('[data-bmg-copy]');
        if (target && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            copy(target);
        }
    });
}());
</script>
<?php
}, 30);
