// FR-16: Upazila names compiled from Bangladesh National Portal upazila listings.
// https://bangladesh.gov.bd/views/upazila-list/Upazilla%20List/
// The existing model supplies district-level screening; selecting an upazila
// must not invent finer-resolution forecasts or geographic exposure claims.
export const UPAZILAS = {
  "Brahmanbaria": [
    "Akhaura",
    "Ashuganj",
    "Bancharampur",
    "Bijoynagar",
    "Brahmanbaria Sadar",
    "Kasba",
    "Nabinagar",
    "Nasirnagar",
    "Sarail"
  ],
  "Habiganj": [
    "Ajmiriganj",
    "Bahubal",
    "Baniachong",
    "Chunarughat",
    "Habiganj Sadar",
    "Lakhai",
    "Madhabpur",
    "Nabiganj",
    "Shayestaganj"
  ],
  "Kishoreganj": [
    "Austagram",
    "Bajitpur",
    "Bhairab",
    "Hossainpur",
    "Itna",
    "Karimganj",
    "Katiadi",
    "Kishoreganj Sadar",
    "Kuliarchar",
    "Mithamain",
    "Nikli",
    "Pakundia",
    "Tarail"
  ],
  "Moulvibazar": [
    "Barlekha",
    "Juri",
    "Kamalganj",
    "Kulaura",
    "Moulvibazar Sadar",
    "Rajnagar",
    "Sreemangal"
  ],
  "Netrakona": [
    "Atpara",
    "Barhatta",
    "Durgapur",
    "Khaliajuri",
    "Kalmakanda",
    "Kendua",
    "Madan",
    "Mohanganj",
    "Netrakona Sadar",
    "Purbadhala"
  ],
  "Sunamganj": [
    "Bishwambarpur",
    "Chhatak",
    "Derai",
    "Dharmapasha",
    "Dowarabazar",
    "Jagannathpur",
    "Jamalganj",
    "Madhyanagar",
    "Shalla",
    "Shantiganj",
    "Sunamganj Sadar",
    "Tahirpur"
  ],
  "Sylhet": [
    "Balaganj",
    "Beanibazar",
    "Bishwanath",
    "Companiganj",
    "Dakshin Surma",
    "Fenchuganj",
    "Golapganj",
    "Gowainghat",
    "Jaintiapur",
    "Kanaighat",
    "Osmani Nagar",
    "Sylhet Sadar",
    "Zakiganj"
  ]
};

export function areaOptions(district) {
  return (UPAZILAS[district] || []).map(name => ({ id: name, label: name }));
}

export function resolveManualLocation(district, areaId, districts) {
  const base = districts.find(item => item.name === district);
  if (!base) return null;
  if (areaId && !(UPAZILAS[district] || []).includes(areaId)) return null;
  // Do not use invented upazila coordinates. District center is a conservative
  // location for existing district-level forecast requests until FR-17.
  return { ...base, selectedUpazila: areaId || null };
}
