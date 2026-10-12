        /* ── Theme Toggle ── */
        function toggleTheme() {
            const body = document.body;
            const btn  = document.getElementById('themeToggle');
            const isLight = body.classList.toggle('light-mode');
            btn.textContent = isLight ? '🌙 Dark Mode' : '☀️ Light Mode';
            localStorage.setItem('ccTheme', isLight ? 'light' : 'dark');
        }

        // Restore saved theme on load
        (function () {
            if (localStorage.getItem('ccTheme') === 'light') {
                document.body.classList.add('light-mode');
                document.getElementById('themeToggle').textContent = '🌙 Dark Mode';
            }
        })();

        /* ── Unified Storage Key Shared with Dashboard ── */
        const SETTINGS_STORAGE_KEY = 'smart_coldchain_settings';

        const defaultColdChainSettings = {
            pharma_min: 2.0,
            pharma_max: 8.0,
            produce_limit: 7.0,
            frozen_limit: -18.0,
            excursion_duration: 45,
            defrost_mode: true,
            tier_warning: true,
            tier_critical: true,
            tier_emergency: true,
            escalation_timer: 15,
            transit_polling: '5',
            idle_polling: '60',
            offline_sync: true,
            data_retention: 365,
            default_role: 'Fleet Manager',
            audit_logging: true,
            temp_unit: 'C',
            dist_unit: 'km',
            timezone_sync: 'UTC',
            compliance_framework: true
        };

        /* ── Load Stored Settings on Page Initialization ── */
        function loadSettings() {
            let cfg = defaultColdChainSettings;
            try {
                const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
                if (stored) {
                    cfg = { ...defaultColdChainSettings, ...JSON.parse(stored) };
                }
            } catch (e) {
                console.error("Failed to parse settings", e);
            }

            const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
            const setChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = Boolean(val); };

            setVal('pharmaMin', cfg.pharma_min);
            setVal('pharmaMax', cfg.pharma_max);
            setVal('perishable', cfg.produce_limit);
            setVal('frozen', cfg.frozen_limit);
            setVal('excursion', cfg.excursion_duration);
            setChk('defrostMode', cfg.defrost_mode);

            setChk('tierWarning', cfg.tier_warning);
            setChk('tierCritical', cfg.tier_critical);
            setChk('tierEmergency', cfg.tier_emergency);
            setVal('escalation', cfg.escalation_timer);

            setVal('transitPolling', cfg.transit_polling);
            setVal('idlePolling', cfg.idle_polling);
            setChk('offlineSync', cfg.offline_sync);
            setVal('retention', cfg.data_retention);

            setVal('defaultRole', cfg.default_role);
            setChk('auditLogging', cfg.audit_logging);

            setVal('tempUnit', cfg.temp_unit);
            setVal('distUnit', cfg.dist_unit);
            setVal('timezoneSync', cfg.timezone_sync);
            setChk('complianceFramework', cfg.compliance_framework);

            handleUnitChange(cfg.temp_unit, false);
        }

        function handleUnitChange(unit, notify = true) {
            const labels = document.querySelectorAll('.unit-label');
            labels.forEach(l => {
                l.textContent = unit === 'F' ? '°F' : '°C';
            });
            if (notify) {
                showToast(`Display unit set to ${unit === 'F' ? 'Fahrenheit (°F)' : 'Celsius (°C)'}`, 'success');
            }
        }

        /* ── Toast Helper ── */
        function showToast(message, type = 'success') {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.className = 'toast' + (type === 'error' ? ' error' : '');
            void toast.offsetWidth;
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 3000);
        }

        /* ── Validation ── */
        function validateSettings() {
            let valid = true;

            const pharmaMin = parseFloat(document.getElementById('pharmaMin').value);
            const pharmaMax = parseFloat(document.getElementById('pharmaMax').value);
            const frozen    = parseFloat(document.getElementById('frozen').value);
            const perishable = parseFloat(document.getElementById('perishable').value);

            const minEl = document.getElementById('pharmaMin');
            const maxEl = document.getElementById('pharmaMax');
            if (pharmaMin >= pharmaMax) {
                minEl.classList.add('invalid');
                maxEl.classList.add('invalid');
                showToast('Pharma Min threshold must be lower than Pharma Max!', 'error');
                valid = false;
            } else {
                minEl.classList.remove('invalid');
                maxEl.classList.remove('invalid');
            }

            const frozenEl = document.getElementById('frozen');
            if (frozen > -18) {
                frozenEl.classList.add('invalid');
                if (valid) showToast('Frozen Goods Threshold must be ≤ −18°C!', 'error');
                valid = false;
            } else {
                frozenEl.classList.remove('invalid');
            }

            const perishEl = document.getElementById('perishable');
            if (perishable < 1 || perishable > 7) {
                perishEl.classList.add('invalid');
                if (valid) showToast('Perishable Produce range must be set between 1°C and 7°C!', 'error');
                valid = false;
            } else {
                perishEl.classList.remove('invalid');
            }

            return valid;
        }

        /* ── Save Settings ── */
        function saveSettings(event) {
            event.preventDefault();
            if (!validateSettings()) return;

            const getVal = (id, fallback) => parseFloat(document.getElementById(id)?.value) || fallback;
            const getInt = (id, fallback) => parseInt(document.getElementById(id)?.value) || fallback;
            const getStr = (id, fallback) => document.getElementById(id)?.value || fallback;
            const getChk = (id) => Boolean(document.getElementById(id)?.checked);

            const payload = {
                pharma_min: getVal('pharmaMin', 2.0),
                pharma_max: getVal('pharmaMax', 8.0),
                produce_limit: getVal('perishable', 7.0),
                frozen_limit: getVal('frozen', -18.0),
                excursion_duration: getInt('excursion', 45),
                defrost_mode: getChk('defrostMode'),

                tier_warning: getChk('tierWarning'),
                tier_critical: getChk('tierCritical'),
                tier_emergency: getChk('tierEmergency'),
                escalation_timer: getInt('escalation', 15),

                transit_polling: getStr('transitPolling', '5'),
                idle_polling: getStr('idlePolling', '60'),
                offline_sync: getChk('offlineSync'),
                data_retention: getInt('retention', 365),

                default_role: getStr('defaultRole', 'Fleet Manager'),
                audit_logging: getChk('auditLogging'),

                temp_unit: getStr('tempUnit', 'C'),
                dist_unit: getStr('distUnit', 'km'),
                timezone_sync: getStr('timezoneSync', 'UTC'),
                compliance_framework: getChk('complianceFramework')
            };

            try {
                localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload));
            } catch (e) {
                console.error("Storage save failed", e);
            }

            showToast('✅ Software configuration saved and synchronized!', 'success');
        }

        /* ── Reset Settings ── */
        function resetSettings() {
            if (confirm('Reset software settings to default operational parameters?')) {
                try {
                    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(defaultColdChainSettings));
                } catch (e) {}
                loadSettings();
                document.querySelectorAll('input.invalid').forEach(el => el.classList.remove('invalid'));
                showToast('Settings restored to operational defaults.', 'success');
            }
        }

        // Initialize on load
        window.addEventListener('DOMContentLoaded', loadSettings);
