/* Nepal administrative divisions for address and shop-location fields.
   This is a representative subset (major districts/municipalities per
   province), not the full 753-municipality dataset — enough to make the
   cascading Province → District → Municipality selects work end to end. */
export const PROVINCES = [
  { id: "koshi", name: "Koshi Province" },
  { id: "madhesh", name: "Madhesh Province" },
  { id: "bagmati", name: "Bagmati Province" },
  { id: "gandaki", name: "Gandaki Province" },
  { id: "lumbini", name: "Lumbini Province" },
  { id: "karnali", name: "Karnali Province" },
  { id: "sudurpashchim", name: "Sudurpashchim Province" },
];

export const DISTRICTS = {
  koshi: [{ id: "morang", name: "Morang" }, { id: "sunsari", name: "Sunsari" }, { id: "jhapa", name: "Jhapa" }],
  madhesh: [{ id: "dhanusha", name: "Dhanusha" }, { id: "parsa", name: "Parsa" }, { id: "bara", name: "Bara" }],
  bagmati: [{ id: "kathmandu", name: "Kathmandu" }, { id: "lalitpur", name: "Lalitpur" }, { id: "bhaktapur", name: "Bhaktapur" }, { id: "chitwan", name: "Chitwan" }],
  gandaki: [{ id: "kaski", name: "Kaski" }, { id: "tanahun", name: "Tanahun" }, { id: "syangja", name: "Syangja" }],
  lumbini: [{ id: "rupandehi", name: "Rupandehi" }, { id: "dang", name: "Dang" }, { id: "kapilvastu", name: "Kapilvastu" }],
  karnali: [{ id: "surkhet", name: "Surkhet" }, { id: "jumla", name: "Jumla" }],
  sudurpashchim: [{ id: "kailali", name: "Kailali" }, { id: "kanchanpur", name: "Kanchanpur" }],
};

export const MUNICIPALITIES = {
  kathmandu: [{ id: "ktm-metro", name: "Kathmandu Metropolitan City" }, { id: "kirtipur", name: "Kirtipur Municipality" }, { id: "budhanilkantha", name: "Budhanilkantha Municipality" }],
  lalitpur: [{ id: "lalitpur-metro", name: "Lalitpur Metropolitan City" }, { id: "godawari", name: "Godawari Municipality" }],
  bhaktapur: [{ id: "bhaktapur-mun", name: "Bhaktapur Municipality" }, { id: "madhyapur", name: "Madhyapur Thimi Municipality" }],
  chitwan: [{ id: "bharatpur-metro", name: "Bharatpur Metropolitan City" }],
  kaski: [{ id: "pokhara-metro", name: "Pokhara Metropolitan City" }],
  tanahun: [{ id: "byas-mun", name: "Byas Municipality" }],
  syangja: [{ id: "putalibazar", name: "Putalibazar Municipality" }],
  rupandehi: [{ id: "butwal-sub", name: "Butwal Sub-Metropolitan City" }, { id: "siddharthanagar", name: "Siddharthanagar Municipality" }],
  dang: [{ id: "ghorahi-sub", name: "Ghorahi Sub-Metropolitan City" }],
  kapilvastu: [{ id: "kapilvastu-mun", name: "Kapilvastu Municipality" }],
  morang: [{ id: "biratnagar-metro", name: "Biratnagar Metropolitan City" }],
  sunsari: [{ id: "itahari-sub", name: "Itahari Sub-Metropolitan City" }, { id: "dharan-sub", name: "Dharan Sub-Metropolitan City" }],
  jhapa: [{ id: "bhadrapur", name: "Bhadrapur Municipality" }],
  dhanusha: [{ id: "janakpur-sub", name: "Janakpur Sub-Metropolitan City" }],
  parsa: [{ id: "birgunj-metro", name: "Birgunj Metropolitan City" }],
  bara: [{ id: "kalaiya-sub", name: "Kalaiya Sub-Metropolitan City" }],
  surkhet: [{ id: "birendranagar-mun", name: "Birendranagar Municipality" }],
  jumla: [{ id: "chandannath-mun", name: "Chandannath Municipality" }],
  kailali: [{ id: "dhangadhi-sub", name: "Dhangadhi Sub-Metropolitan City" }],
  kanchanpur: [{ id: "bhimdatta-mun", name: "Bhimdatta Municipality" }],
};

export const districtsFor = (provinceId) => DISTRICTS[provinceId] || [];
export const municipalitiesFor = (districtId) => MUNICIPALITIES[districtId] || [];
export const provinceName = (id) => PROVINCES.find((p) => p.id === id)?.name || "";
export const districtName = (provinceId, id) => districtsFor(provinceId).find((d) => d.id === id)?.name || "";
export const municipalityName = (districtId, id) => municipalitiesFor(districtId).find((m) => m.id === id)?.name || "";
