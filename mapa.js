// Este archivo JavaScript se encarga de crear y configurar un mapa interactivo usando la biblioteca OpenLayers
// Se ejecuta cuando el documento HTML está completamente cargado
document.addEventListener("DOMContentLoaded", function () {
    // --- MENU TOGGLE LOGIC ---
    const menuBtn = document.getElementById('menuBtn');
    const topMenu = document.getElementById('topMenu');
    menuBtn.addEventListener('click', function() {
        topMenu.classList.toggle('active');
    });

    // --- BASE MAP LAYERS ---
    const baseLayers = {
        carto_light: new ol.layer.Tile({
            source: new ol.source.XYZ({
                url: 'https://{1-4}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
            }),
            visible: true
        }),
        carto_dark: new ol.layer.Tile({
            source: new ol.source.XYZ({
                url: 'https://{1-4}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            }),
            visible: false
        }),
        carto_voyager: new ol.layer.Tile({
            source: new ol.source.XYZ({
                url: 'https://{1-4}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
            }),
            visible: false
        }),
        esri_topo: new ol.layer.Tile({
            source: new ol.source.XYZ({
                url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
                attributions: 'Tiles © Esri'
            }),
            visible: false
        }),
        esri_imagery: new ol.layer.Tile({
            source: new ol.source.XYZ({
                url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                attributions: 'Tiles © Esri'
            }),
            visible: false
        })
    };

    // Create map with all base layers (only one visible at a time)
    const map = new ol.Map({
        target: "map",
        layers: [
            baseLayers.carto_light,
            baseLayers.carto_dark,
            baseLayers.carto_voyager,
            baseLayers.esri_topo,
            baseLayers.esri_imagery
        ],
        view: new ol.View({
            center: ol.proj.fromLonLat([-3.70, 40.55]), // Madrid coordinates
            zoom: 9.5
        })
    });

    // Add center map control
    const centerMapControl = new ol.control.Control({
        element: (function() {
            const button = document.createElement('button');
            button.className = 'ol-center-map';
            button.title = 'Center map';
            button.innerHTML = '⌂';
            button.addEventListener('click', function() {
                map.getView().animate({
                    center: ol.proj.fromLonLat([-3.70, 40.58]),
                    zoom: 9.3,
                    duration: 1000
                });
            });
            const element = document.createElement('div');
            element.className = 'ol-center-map ol-unselectable ol-control';
            element.appendChild(button);
            return element;
        })()
    });
    map.addControl(centerMapControl);

    // Handle base map switching
    const baseMapSelect = document.getElementById('baseMapSelect');
    baseMapSelect.addEventListener('change', function() {
        Object.entries(baseLayers).forEach(([key, layer]) => {
            layer.setVisible(key === baseMapSelect.value);
        });
    });

    // Create vector sources for both nucleos_urbanos and municipios
    const nucleosSource = new ol.source.Vector({
        format: new ol.format.GeoJSON({
            dataProjection: 'EPSG:3857',
            geometryName: 'geometry'
        }),
        loader: function(extent, resolution, projection, success, failure) {
            const url = "http://localhost:5501/output_data/geojson/nucleos_urbanos.geojson";
            const xhr = new XMLHttpRequest();
            xhr.open('GET', url);
            xhr.onload = function() {
                if (xhr.status === 200) {
                    const features = nucleosSource.getFormat().readFeatures(xhr.responseText);
                    nucleosSource.addFeatures(features);
                    success(features);
                } else {
                    failure();
                }
            };
            xhr.onerror = function() {
                failure();
            };
            xhr.send();
        },
        strategy: ol.loadingstrategy.all // Change to all to load everything at once
    });

    // Force loading by requesting features for the initial extent
    const initialExtent = map.getView().calculateExtent(map.getSize());
    nucleosSource.loadFeatures(initialExtent, map.getView().getResolution(), map.getView().getProjection());

    const municipiosSource = new ol.source.Vector({
        url: "http://localhost:5501/output_data/geojson/municipios.geojson",
        format: new ol.format.GeoJSON({
            dataProjection: 'EPSG:3857',
            geometryName: 'geometry'
        })
    });

    // Add source ready event listeners for debugging
    nucleosSource.on('change', function() {
        if (nucleosSource.getState() === 'ready') {
            // console.log('Nucleos source ready, features:', nucleosSource.getFeatures().length);
        }
    });

    municipiosSource.on('change', function() {
        if (municipiosSource.getState() === 'ready') {
            // console.log('Municipios source ready, features:', municipiosSource.getFeatures().length);
        }
    });

    // Store min and max durations for each category
    const durationRanges = {};

    // Calculate min and max durations for each category
    function calculateDurationRanges(source) {
        source.on('change', function() {
            if (source.getState() === 'ready') {
                const features = source.getFeatures();
                const categories = [
                    'duracion_s_hospital_driving',
                    'duracion_s_hospital_transit',
                    'duracion_s_centro_salud_driving',
                    'duracion_s_centro_salud_transit',
                    'duracion_s_consultorio_driving',
                    'duracion_s_consultorio_transit',
                    'duracion_s_universidad_driving',
                    'duracion_s_universidad_transit'
                ];

                categories.forEach(category => {
                    const durations = features
                        .map(f => f.get(category))
                        .filter(d => d > 0); // Exclude 0 values
                    
                    if (durations.length > 0) {
                        const range = {
                            min: Math.min(...durations),
                            max: Math.max(...durations)
                        };
                        // Update range if it's wider than existing range
                        if (!durationRanges[category] || 
                            range.min < durationRanges[category].min || 
                            range.max > durationRanges[category].max) {
                            durationRanges[category] = range;
                            // console.log(`${category} range:`, durationRanges[category]);
                        }
                    }
                });
            }
        });
    }

    calculateDurationRanges(nucleosSource);
    calculateDurationRanges(municipiosSource);

    // Map keys to user-friendly names
    const categoryOptions = {
        'nucleos_hospital_driving': 'Hospital (Coche)',
        'nucleos_hospital_transit': 'Hospital (Transporte Público)',
        'nucleos_centro_salud_driving': 'Centro de Salud (Coche)',
        'nucleos_centro_salud_transit': 'Centro de Salud (Transporte Público)',
        'nucleos_consultorio_driving': 'Consultorio (Coche)',
        'nucleos_consultorio_transit': 'Consultorio (Transporte Público)',
        'nucleos_universidad_driving': 'Universidad (Coche)',
        'nucleos_universidad_transit': 'Universidad (Transporte Público)',
        'nucleos_health_services_score_driving': 'Puntuación Servicios Sanitarios (Coche)',
        'nucleos_health_services_score_transit': 'Puntuación Servicios Sanitarios (Transporte Público)',
        'municipios_hospital_driving': 'Hospital (Coche)',
        'municipios_hospital_transit': 'Hospital (Transporte Público)',
        'municipios_centro_salud_driving': 'Centro de Salud (Coche)',
        'municipios_centro_salud_transit': 'Centro de Salud (Transporte Público)',
        'municipios_consultorio_driving': 'Consultorio (Coche)',
        'municipios_consultorio_transit': 'Consultorio (Transporte Público)',
        'municipios_universidad_driving': 'Universidad (Coche)',
        'municipios_universidad_transit': 'Universidad (Transporte Público)',
        'municipios_health_services_score_driving': 'Puntuación Servicios Sanitarios (Coche)',
        'municipios_health_services_score_transit': 'Puntuación Servicios Sanitarios (Transporte Público)'
    };

    // Function to create a style based on score or duration
    function createStyle(fieldName) {
        return function(feature) {
            const value = feature.get(fieldName);
            // Handle no data case
            if (value === 0 || value === 1) {
                return new ol.style.Style({
                    fill: new ol.style.Fill({
                        color: 'rgba(200, 200, 200, 0.3)' // Gray for no data
                    }),
                    stroke: new ol.style.Stroke({
                        color: 'rgba(100, 100, 100, 0.5)',
                        width: 1
                    })
                });
            }
            // Get the range for this category
            const range = durationRanges[fieldName];
            if (!range && !fieldName.includes('health_services_score')) return null;
            let normalized;
            let r, b;
            if (fieldName.includes('health_services_score')) {
                // For scores, higher is better (blue), lower is worse (red)
                normalized = value; // Scores are already normalized 0-1
                r = Math.round(255 * (1 - normalized));
                b = Math.round(255 * normalized);
            } else {
                // For durations, lower is better (blue), higher is worse (red)
                normalized = (value - range.min) / (range.max - range.min);
                r = Math.round(255 * normalized);
                b = Math.round(255 * (1 - normalized));
            }
            const color = `rgba(${r}, 0, ${b}, 0.6)`;
            return new ol.style.Style({
                fill: new ol.style.Fill({
                    color: color
                }),
                stroke: new ol.style.Stroke({
                    color: 'rgba(0, 0, 0, 0.5)',
                    width: 1
                })
            });
        };
    }

    // Function to create a vector layer for a specific duration field
    function createVectorLayer(source, fieldName, title) {
        return new ol.layer.Vector({
            source: source,
            style: createStyle(fieldName),
            title: title,
            updateWhileAnimating: true,
            updateWhileInteracting: true
        });
    }

    // Create vector layers for each duration and score category
    const vectorLayers = {
        'nucleos_hospital_driving': createVectorLayer(nucleosSource, 'duracion_s_hospital_driving', 'Núcleos - Hospital (Coche)'),
        'nucleos_hospital_transit': createVectorLayer(nucleosSource, 'duracion_s_hospital_transit', 'Núcleos - Hospital (Transporte Público)'),
        'nucleos_centro_salud_driving': createVectorLayer(nucleosSource, 'duracion_s_centro_salud_driving', 'Núcleos - Centro de Salud (Coche)'),
        'nucleos_centro_salud_transit': createVectorLayer(nucleosSource, 'duracion_s_centro_salud_transit', 'Núcleos - Centro de Salud (Transporte Público)'),
        'nucleos_consultorio_driving': createVectorLayer(nucleosSource, 'duracion_s_consultorio_driving', 'Núcleos - Consultorio (Coche)'),
        'nucleos_consultorio_transit': createVectorLayer(nucleosSource, 'duracion_s_consultorio_transit', 'Núcleos - Consultorio (Transporte Público)'),
        'nucleos_universidad_driving': createVectorLayer(nucleosSource, 'duracion_s_universidad_driving', 'Núcleos - Universidad (Coche)'),
        'nucleos_universidad_transit': createVectorLayer(nucleosSource, 'duracion_s_universidad_transit', 'Núcleos - Universidad (Transporte Público)'),
        'nucleos_health_services_score_driving': createVectorLayer(nucleosSource, 'health_services_score_driving', 'Núcleos - Score Servicios Sanitarios (Coche)'),
        'nucleos_health_services_score_transit': createVectorLayer(nucleosSource, 'health_services_score_transit', 'Núcleos - Score Servicios Sanitarios (Transporte Público)'),
        'municipios_hospital_driving': createVectorLayer(municipiosSource, 'duracion_s_hospital_driving', 'Municipios - Hospital (Coche)'),
        'municipios_hospital_transit': createVectorLayer(municipiosSource, 'duracion_s_hospital_transit', 'Municipios - Hospital (Transporte Público)'),
        'municipios_centro_salud_driving': createVectorLayer(municipiosSource, 'duracion_s_centro_salud_driving', 'Municipios - Centro de Salud (Coche)'),
        'municipios_centro_salud_transit': createVectorLayer(municipiosSource, 'duracion_s_centro_salud_transit', 'Municipios - Centro de Salud (Transporte Público)'),
        'municipios_consultorio_driving': createVectorLayer(municipiosSource, 'duracion_s_consultorio_driving', 'Municipios - Consultorio (Coche)'),
        'municipios_consultorio_transit': createVectorLayer(municipiosSource, 'duracion_s_consultorio_transit', 'Municipios - Consultorio (Transporte Público)'),
        'municipios_universidad_driving': createVectorLayer(municipiosSource, 'duracion_s_universidad_driving', 'Municipios - Universidad (Coche)'),
        'municipios_universidad_transit': createVectorLayer(municipiosSource, 'duracion_s_universidad_transit', 'Municipios - Universidad (Transporte Público)'),
        'municipios_health_services_score_driving': createVectorLayer(municipiosSource, 'health_services_score_driving', 'Municipios - Score Servicios Sanitarios (Coche)'),
        'municipios_health_services_score_transit': createVectorLayer(municipiosSource, 'health_services_score_transit', 'Municipios - Score Servicios Sanitarios (Transporte Público)')
    };

    // Add all vector layers to the map (initially hidden)
    Object.values(vectorLayers).forEach(layer => {
        layer.setVisible(false);
        map.addLayer(layer);
    });

    // --- LEGEND AT BOTTOM RIGHT ---
    const legend = document.createElement('div');
    legend.className = 'legend';

    const legendTitle = document.createElement('div');
    legendTitle.className = 'legend-title';
    legendTitle.textContent = 'Leyenda';
    legend.appendChild(legendTitle);

    const legendGradient = document.createElement('div');
    legendGradient.className = 'legend-gradient';
    legend.appendChild(legendGradient);

    const legendLabels = document.createElement('div');
    legendLabels.className = 'legend-labels';
    legendLabels.innerHTML = '<span>Cerca</span><span>Lejos</span>';
    legend.appendChild(legendLabels);

    document.body.appendChild(legend);

    // --- CATEGORY DROPDOWN IN MENU ---
    const categorySelectContainer = document.getElementById('categorySelectContainer');
    const categoryLabel = document.createElement('label');
    categoryLabel.htmlFor = 'categorySelect';
    categoryLabel.style.fontWeight = 'bold';
    categoryLabel.textContent = 'Filtro: ';
    categorySelectContainer.appendChild(categoryLabel);

    const categorySelect = document.createElement('select');
    categorySelect.id = 'categorySelect';
    categorySelect.style.marginRight = '10px';
    categorySelectContainer.appendChild(categorySelect);

    // Function to update category dropdown based on selected layer type
    function updateCategoryDropdown() {
        const layerType = document.getElementById('layerTypeSelect').value;
        categorySelect.innerHTML = ''; // Clear existing options

        // Filter and add options based on selected layer type
        Object.entries(categoryOptions)
            .filter(([key]) => key.startsWith(layerType))
            .forEach(([key, label]) => {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = label;
                categorySelect.appendChild(option);
            });

        // Update the visible layer
        updateCategoryLayer();
    }

    // Handle layer type changes
    const layerTypeSelect = document.getElementById('layerTypeSelect');
    layerTypeSelect.addEventListener('change', function() {
        isUserSelection = false; // Reset user selection flag
        updateCategoryDropdown();
    });

    // Handle category changes
    categorySelect.addEventListener('change', function() {
        isUserSelection = false; // Reset user selection flag
        updateCategoryLayer();
    });

    // Function to create a highlight style
    function createHighlightStyle() {
        return new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: '#2196f3',
                width: 3
            }),
            fill: new ol.style.Fill({
                color: 'rgba(33, 150, 243, 0.1)'
            })
        });
    }

    // Store the currently highlighted feature
    let highlightedFeature = null;
    let hoveredFeature = null; // Track the currently hovered feature
    let selectedFeatureName = null;
    let isUserSelection = false; // Add flag to track user selection
    let isInitialLoad = true;

    // Function to create a hover style
    function createHoverStyle() {
        return new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: '#ff9800', // Orange border for hover
                width: 3
            }),
            fill: new ol.style.Fill({
                color: 'rgba(255, 152, 0, 0.08)'
            })
        });
    }

    // Function to highlight a feature
    function highlightFeature(feature, isUserAction = false) {
        // Remove highlight from previous feature
        if (highlightedFeature) {
            highlightedFeature.setStyle(null);
        }
        highlightedFeature = null;
        selectedFeatureName = null;
        isUserSelection = false;
        if (feature) {
            feature.setStyle(createHighlightStyle());
            highlightedFeature = feature;
            selectedFeatureName = feature.get('nombre');
            isUserSelection = isUserAction;
            updateListSelection(feature.get('nombre'));

            // Center and zoom the map on the feature
            const extent = feature.getGeometry().getExtent();
            const layerType = document.getElementById('layerTypeSelect').value;
            if (layerType === 'nucleos') {
                map.getView().fit(extent, {
                    padding: [30, 30, 30, 30], // less padding = more zoom
                    maxZoom: 12.5, // allow more zoom in
                    duration: 1000
                });
            } else {
                map.getView().fit(extent, {
                    padding: [80, 80, 80, 80],
                    maxZoom: 10.5,
                    duration: 1000
                });
            }

            // Scroll the ordered list to show the selected feature
            const listItems = document.querySelectorAll('.ordered-list li');
            const targetItem = Array.from(listItems).find(item => 
                item.querySelector('.name').textContent === feature.get('nombre')
            );
            
            if (targetItem) {
                const orderedList = document.getElementById('orderedList');
                const listRect = orderedList.getBoundingClientRect();
                const itemRect = targetItem.getBoundingClientRect();
                
                // Calculate scroll position to center the item
                const scrollTop = targetItem.offsetTop - (orderedList.clientHeight / 2) + (targetItem.clientHeight / 2);
                orderedList.scrollTop = scrollTop;
            }
        } else {
            updateListSelection(null);
        }
    }

    // Function to update list selection
    function updateListSelection(featureName) {
        const listItems = document.querySelectorAll('.ordered-list li');
        listItems.forEach(item => {
            const itemName = item.querySelector('.name').textContent;
            if (featureName && itemName === featureName) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }

    // Function to update the ordered list
    function updateOrderedList() {
        const layerType = document.getElementById('layerTypeSelect').value;
        const category = document.getElementById('categorySelect').value;
        const field = category.includes('health_services_score')
            ? category.replace(/^nucleos_/, '').replace(/^municipios_/, '')
            : 'duracion_s_' + category.split('_').slice(1).join('_');
        const source = layerType === 'nucleos' ? nucleosSource : municipiosSource;
        
        if (source.getState() === 'ready') {
            const features = source.getFeatures()
                .filter(f => {
                    const value = f.get(field);
                    return value > 0 && value !== 1; // Exclude 0 and 1 values
                });
            
            // Sort features
            if (category.includes('health_services_score')) {
                // Sort by score (higher is better)
                features.sort((a, b) => b.get(field) - a.get(field));
            } else {
                // Sort by duration (lower is better)
                features.sort((a, b) => a.get(field) - b.get(field));
            }
            
            const listContent = document.getElementById('orderedListContent');
            listContent.innerHTML = ''; // Clear existing content
            
            features.forEach((feature, index) => {
                const value = feature.get(field);
                let displayValue;
                if (category.includes('health_services_score')) {
                    displayValue = (value * 100).toFixed(1) + '%';
                } else {
                    displayValue = Math.round(value / 60) + ' min';
                }
                
                const li = document.createElement('li');
                li.innerHTML = `
                    <span class="index">${index + 1}.</span>
                    <span class="name">${feature.get('nombre')}</span>
                    <span class="duration">${displayValue}</span>
                `;
                
                // Add selected class if this is the currently selected feature
                if (feature.get('nombre') === selectedFeatureName) {
                    li.classList.add('selected');
                }
                
                // Add click handler
                li.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // If clicking the same feature, deselect it
                    if (feature.get('nombre') === selectedFeatureName) {
                        highlightFeature(null);
                        popupContainer.classList.remove('visible');
                    } else {
                        // Highlight the feature on the map
                        highlightFeature(feature, true); // Pass true to indicate user action
                        showPopupForFeature(feature);
                    }
                });
                
                listContent.appendChild(li);
            });

            // After initial load, set flag to false
            if (isInitialLoad) {
                isInitialLoad = false;
            }
        }
    }

    // Update ordered list when sources are ready
    nucleosSource.on('change', function() {
        if (nucleosSource.getState() === 'ready') {
            // console.log('Nucleos source ready, features:', nucleosSource.getFeatures().length);
            // Only update if we're showing nucleos
            if (document.getElementById('layerTypeSelect').value === 'nucleos') {
                updateOrderedList();
            }
        }
    });

    municipiosSource.on('change', function() {
        if (municipiosSource.getState() === 'ready') {
            // console.log('Municipios source ready, features:', municipiosSource.getFeatures().length);
            // Only update if we're showing municipios
            if (document.getElementById('layerTypeSelect').value === 'municipios') {
                updateOrderedList();
            }
        }
    });

    // Show only the selected category layer
    function updateCategoryLayer() {
        const selectedKey = categorySelect.value;
        Object.entries(vectorLayers).forEach(([key, layer]) => {
            layer.setVisible(key === selectedKey);
        });
        // Update legend
        let legendHTML = '';
        if (selectedKey.includes('health_services_score')) {
            legendHTML = `<span>Mejor (100%)</span><span>Peor (0%)</span>`;
        } else {
            const fieldName = selectedKey.split('_').slice(1).join('_').replace('_', 's_');
            const range = durationRanges[fieldName];
            if (range) {
                const minMinutes = Math.round(range.min / 60);
                const maxMinutes = Math.round(range.max / 60);
                legendHTML = `<span>Cerca (${minMinutes} min)</span><span>Lejos (${maxMinutes} min)</span>`;
            }
        }
        legendLabels.innerHTML = legendHTML;
        // Update ordered list
        updateOrderedList();
    }

    // Set initial selections
    layerTypeSelect.value = 'municipios';
    updateCategoryDropdown();
    categorySelect.value = 'municipios_health_services_score_transit';
    updateCategoryLayer();

    // Create a new popup element
    const popupContainer = document.createElement('div');
    popupContainer.id = 'feature-info';
    popupContainer.className = 'ordered-list';
    popupContainer.style.bottom = '20px';
    popupContainer.style.left = '20px';
    popupContainer.style.top = 'auto';
    popupContainer.style.right = 'auto';
    document.body.appendChild(popupContainer);

    // Add CSS for the new popup
    const style = document.createElement('style');
    style.textContent = `
        #feature-info {
            position: fixed !important;
            bottom: 20px !important;
            left: 20px !important;
            background: white;
            border: 1px solid #ccc;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            padding: 15px;
            width: 280px;
            max-height: 80vh;
            overflow-y: auto;
            z-index: 1200;
            display: none;
        }
        #feature-info.visible {
            display: block;
        }
        #feature-info h3 {
            margin: 0 0 10px 0;
            font-size: 1.2em;
            color: #2196f3;
        }
        #feature-info p {
            margin: 5px 0;
            line-height: 1.4;
            font-size: 14px;
        }
        #feature-info .duration {
            font-weight: bold;
            color: #2196f3;
        }
        #feature-info .close-btn {
            position: absolute;
            top: 10px;
            right: 10px;
            cursor: pointer;
            color: #666;
            font-size: 1.2em;
            padding: 5px;
            text-decoration: none;
        }
        #feature-info .close-btn:hover {
            color: #333;
        }
    `;
    document.head.appendChild(style);

    // Build lookup maps for nucleos urbanos and municipios
    let nucleosIdToName = {};
    let municipiosIdToName = {};
    
    nucleosSource.on('change', function() {
        if (nucleosSource.getState() === 'ready') {
            nucleosIdToName = {};
            nucleosSource.getFeatures().forEach(f => {
                nucleosIdToName[String(f.get('id'))] = f.get('nombre');
            });
        }
    });
    municipiosSource.on('change', function() {
        if (municipiosSource.getState() === 'ready') {
            municipiosIdToName = {};
            municipiosSource.getFeatures().forEach(f => {
                municipiosIdToName[String(f.get('id'))] = f.get('nombre');
            });
        }
    });
    // Build immediately if already ready
    if (nucleosSource.getState() === 'ready') {
        nucleosIdToName = {};
        nucleosSource.getFeatures().forEach(f => {
            nucleosIdToName[String(f.get('id'))] = f.get('nombre');
        });
    }
    if (municipiosSource.getState() === 'ready') {
        municipiosIdToName = {};
        municipiosSource.getFeatures().forEach(f => {
            municipiosIdToName[String(f.get('id'))] = f.get('nombre');
        });
    }

    // Function to show popup for a feature
    function showPopupForFeature(feature) {
        console.log('Showing popup for feature:', feature.get('nombre')); // Debug log
        const properties = feature.getProperties();
        const category = document.getElementById('categorySelect').value;
        let value, displayValue;
        if (category.includes('health_services_score')) {
            const field = category.replace(/^nucleos_/, '').replace(/^municipios_/, '');
            value = properties[field];
            if (typeof value === 'number' && !isNaN(value) && value !== 0 && value !== 1) {
                displayValue = (value * 100).toFixed(1) + '%';
            } else {
                displayValue = 'N/A';
            }
        } else {
            const durationField = 'duracion_s_' + category.split('_').slice(1).join('_');
            value = properties[durationField];
            displayValue = value ? Math.round(value / 60) + ' min' : 'N/A';
        }
        
        let content = '';
        content += `<span class="close-btn">×</span>`;
        content += `<h3>${properties.nombre || 'Sin nombre'}</h3>`;
        content += `<p class="duration">${displayValue}</p>`;
        if (properties.poblacion) {
            content += `<p>Población: ${properties.poblacion.toLocaleString()}</p>`;
        }
        if (properties.area) {
            content += `<p>Área: ${(properties.area / 1000000).toFixed(2)} km²</p>`;
        }
        // Show relations if the relevant lookup map is ready
        if (properties.nucleos_urbanos && Array.isArray(properties.nucleos_urbanos)) {
            if (Object.keys(nucleosIdToName).length) {
                const nucleosList = properties.nucleos_urbanos
                    .map(id => nucleosIdToName[String(id)] || `(ID: ${id})`)
                    .filter(name => !!name);
                if (nucleosList.length > 0) {
                    content += `<p><b>Núcleos urbanos:</b><br>${nucleosList.join('<br>')}</p>`;
                }
            } else {
                content += `<p><i>Cargando relaciones...</i></p>`;
            }
        } else if (properties.municipio) {
            if (Object.keys(municipiosIdToName).length) {
                const municipioName = municipiosIdToName[String(properties.municipio)] || `(ID: ${properties.municipio})`;
                if (municipioName) {
                    content += `<p><b>Municipio:</b> ${municipioName}</p>`;
                }
            } else {
                content += `<p><i>Cargando relaciones...</i></p>`;
            }
        }
        
        popupContainer.innerHTML = content;
        popupContainer.classList.add('visible');

        // Add click handler for close button
        const closeBtn = popupContainer.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.onclick = function() {
                popupContainer.classList.remove('visible');
                return false;
            };
        }
    }

    // Modify the click handler to hide the popup when clicking outside
    map.on('click', function(evt) {
        const feature = map.forEachFeatureAtPixel(evt.pixel, function(feature) {
            return feature;
        });
        if (feature) {
            // Remove hover style if present
            if (hoveredFeature && hoveredFeature !== feature) {
                hoveredFeature.setStyle(null);
                hoveredFeature = null;
            }
            // Highlight the clicked feature
            highlightFeature(feature, true);
            // Show popup
            showPopupForFeature(feature);
        } else {
            // Deselect if clicking outside
            if (highlightedFeature) {
                highlightFeature(null);
            }
            popupContainer.classList.remove('visible');
        }
    });

    // --- HOVER INTERACTION ---
    map.on('pointermove', function(evt) {
        const pixel = map.getEventPixel(evt.originalEvent);
        const feature = map.forEachFeatureAtPixel(pixel, function(feature) {
            return feature;
        });
        // Remove hover style from previous feature if it's not the selected one
        if (hoveredFeature && hoveredFeature !== highlightedFeature) {
            hoveredFeature.setStyle(null);
            hoveredFeature = null;
        }
        // Apply hover style if not selected
        if (feature && feature !== highlightedFeature) {
            feature.setStyle(createHoverStyle());
            hoveredFeature = feature;
        } else {
            hoveredFeature = null;
        }
        map.getTargetElement().style.cursor = feature ? 'pointer' : '';
    });

    // Center map button click handler
    document.querySelector('.ol-center-map').addEventListener('click', function() {
        // Reset to initial Madrid coordinates and zoom level
        map.getView().animate({
            center: ol.proj.fromLonLat([-3.7038, 40.4168]),
            zoom: 10,
            duration: 1000
        });
    });
});
