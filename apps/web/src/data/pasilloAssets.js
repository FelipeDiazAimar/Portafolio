// Assets reales de cada pasillo de Experiencia: modelos 3D escaneados y texturas PBR de Poly Haven
// (https://polyhaven.com, licencia CC0: libres, sin atribución obligatoria).
//
// Regla: NINGÚN modelo ni textura se repite entre pasillos (scripts/assets-pasillo.mjs lo
// verifica), y dentro de un pasillo cada modelo aparece lo menos posible (ver relleno.js).
//
// Roles de los modelos:
// - estante: cosas chicas que van en estantes, mesadas y arriba de los muebles.
// - piso: cosas que se apoyan en el piso, contra la pared o delante de los estantes.
// - mueble: muebles grandes que ocupan un tramo de pared (reemplazan a una estantería).
// - pared: cosas colgadas de la pared.
// - techo: cosas que cuelgan del techo.
//
// Las texturas son de Poly Haven por id; se bajan diffuse, normal (GL) y ARM (oclusión,
// rugosidad, metal). Se publican en /pasillo/t/<id>_{diff,nor,arm}.webp.
// Los modelos se publican optimizados en /pasillo/m/<id>.glb.

export const AMBIENTES = {
  laboratorio: {
    texturas: { piso: 'old_linoleum_flooring_01', pared: 'painted_plaster_wall', estante: 'blue_metal_plate' },
    modelos: {
      estante: [
        'circuit_board',
        'retro_multimeter',
        'magnifying_glass_01',
        'industrial_microscope',
        'screwdriver',
        'flathead_screwdriver',
        'pliers',
        'measuring_tape_01',
        'lightbulb_01',
        'small_plastic_torch',
        'power_box_01',
        'desk_lamp_arm_01',
        'combination_wrench',
        'screwdrivers_02',
        'adjustable_wrench',
      ],
      piso: ['drill_press_01', 'industrial_pastic_container'],
      mueble: ['steel_frame_shelves_01', 'metal_office_desk'],
      pared: [],
      techo: ['mounted_fluorescent_lights'],
    },
  },
  docencia: {
    texturas: { piso: 'herringbone_parquet', pared: 'beige_wall_001', estante: 'wood_table_worn' },
    modelos: {
      estante: [
        'book_encyclopedia_set_01',
        'binder_notebook',
        'clipboard',
        'stationery_supplies',
        'vintage_stapler',
        'round_spectacles',
        'chess_set',
        'alarm_clock_01',
        'filmstrip_projector_8mm',
        'office_notepads',
      ],
      piso: ['SchoolDesk_01', 'SchoolChair_01', 'projector_screen', 'standing_chalkboard_01'],
      mueble: ['wooden_bookshelf_worn', 'vintage_cabinet_01', 'painted_wooden_shelves', 'vintage_grandfather_clock_01'],
      pared: ['fancy_picture_frame_01', 'hanging_picture_frame_02', 'wall_clock'],
      techo: ['lantern_chandelier_01'],
    },
  },
  freelance: {
    texturas: { piso: 'laminate_floor_02', pared: 'painted_brick', estante: 'plywood' },
    modelos: {
      estante: [
        'classic_laptop',
        'Camera_01',
        'digital_wrist_watch',
        'potted_plant_04',
        'ceramic_vase_01',
        'ceramic_vase_02',
        'ceramic_vase_03',
        'ceramic_vase_04',
        'wooden_candlestick',
        'wicker_basket_01',
        'wicker_basket_02',
        'standing_picture_frame_01',
        'standing_picture_frame_02',
        'brass_vase_01',
        'brass_candleholders',
        'brass_diya_lantern',
        'vintage_oil_lamp',
        'medical_box',
      ],
      piso: ['old_tyre', 'modern_arm_chair_01', 'potted_plant_01', 'potted_plant_02', 'planter_box_01', 'ceramic_pot', 'Sofa_01'],
      // (sin wooden_display_shelves_01: es más profunda que el tramo y quedaba metida en la estantería)
      mueble: ['modern_wooden_cabinet', 'side_table_01'],
      pared: ['hanging_picture_frame_01'],
      techo: ['modern_ceiling_lamp_01'],
    },
  },
  tecnico: {
    texturas: { piso: 'garage_floor', pared: 'concrete_block_wall', estante: 'fine_grained_wood' },
    modelos: {
      estante: [
        'vintage_radio_transceiver',
        'cassette_player',
        'portable_cassette_player',
        'vintage_video_camera',
        'ratchet_wrench',
        'tongue_groove_pliers',
        'lubricant_spray',
        'security_camera_01',
        'lightbulb_led',
        'Drill_01',
        'bench_vice_01',
        'metal_toolbox',
        'CashRegister_01',
        'cleaner_tin_01',
      ],
      piso: ['old_drill_press'],
      mueble: ['drawer_cabinet', 'worn_metal_rack', 'steel_frame_shelves_02', 'steel_frame_shelves_03', 'tool_cart', 'metal_tool_chest'],
      pared: ['vintage_telephone_wall_clock', 'industrial_wall_lamp'],
      techo: ['industrial_pipe_lamp'],
    },
  },
  mbrf: {
    texturas: { piso: 'anti_skid_tiles', pared: 'long_white_tiles', estante: 'metal_plate_02' },
    modelos: {
      estante: [
        'multi_cleaner_bottle',
        'bleach_bottle',
        'all_purpose_cleaner',
        'long_life_food',
        'russian_food_cans_01',
        'security_camera_02',
        'plastic_bottle_gallon',
        'oil_tin',
        'plastic_container',
        'plastic_thermos',
        'modified_thermos',
      ],
      piso: [
        'cardboard_box_01',
        'plastic_crate_02',
        'plastic_crate_03',
        'hand_truck',
        'Barrel_01',
        'barrel_03',
        'rubber_boots',
        'ladder_sectioned_01',
        'WetFloorSign_01',
        'portable_generator',
        'multi_cleaner_5_litre',
        'korean_fire_extinguisher_01',
        'plastic_crate_01',
      ],
      mueble: ['utility_box_01', 'utility_box_02', 'exterior_aircon_unit', 'modular_industrial_pipes_01'],
      pared: ['fire_alarm', 'security_light', 'industrial_caged_sconce'],
      techo: ['hanging_industrial_lamp', 'caged_hanging_light'],
    },
  },
};

// Techo compartido (no es una "cosa" del pasillo, es la losa).
export const TEXTURA_TECHO = 'white_plaster_02';

export function todosLosModelos() {
  return Object.values(AMBIENTES).flatMap((a) => Object.values(a.modelos).flat());
}

export function todasLasTexturas() {
  return [...Object.values(AMBIENTES).flatMap((a) => Object.values(a.texturas)), TEXTURA_TECHO];
}
