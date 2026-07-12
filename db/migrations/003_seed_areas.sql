-- ============================================================================
-- 003_seed_areas.sql — Taxonomía inicial de áreas (editable por Administración)
-- "Casos personales" y "Salud espiritual" son áreas RESTRINGIDAS (Art. 9 RGPD).
-- ============================================================================

INSERT INTO areas (name, slug, is_restricted) VALUES
  ('Elecciones',                            'elecciones',                          false),
  ('Administración',                        'administracion',                      false),
  ('Instituto',                             'instituto',                           false),
  ('Crecimiento de las agrupaciones',       'crecimiento-agrupaciones',            false),
  ('Región Este',                           'region-este',                         false),
  ('Región Norte',                          'region-norte',                        false),
  ('Región Sur',                            'region-sur',                          false),
  ('Educación',                             'educacion',                           false),
  ('Fondo y finanzas',                      'fondo-finanzas',                      false),
  ('Propiedades e inmuebles',               'propiedades-inmuebles',               false),
  ('Asuntos jurídicos',                     'asuntos-juridicos',                   false),
  ('Asuntos públicos',                      'asuntos-publicos',                    false),
  ('Relaciones institucionales',            'relaciones-institucionales',          false),
  ('Editorial y publicaciones',             'editorial-publicaciones',             false),
  ('Traducciones',                          'traducciones',                        false),
  ('Secretaría',                            'secretaria',                          false),
  ('Funcionamiento interno de la Asamblea', 'funcionamiento-interno',              false),
  ('Tecnologías',                           'tecnologias',                         false),
  ('Comunicación interna',                  'comunicacion-interna',                false),
  ('Comités y agencias',                    'comites-agencias',                    false),
  ('Llíria',                                'lliria',                              false),
  ('Eventos y vida comunitaria',            'eventos-vida-comunitaria',            false),
  ('Casos personales',                      'casos-personales',                    true),
  ('Salud espiritual',                      'salud-espiritual',                    true);
