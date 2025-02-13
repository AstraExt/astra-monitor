/*!
 * Copyright (C) 2023 Lju
 *
 * (Based on original work from https://raw.githubusercontent.com/dgallegos/edidreader/27956d35ada72da3713d5f2c92145964016abc2d/app/js/edid.js)
 *
 * This file is part of Astra Monitor extension for GNOME Shell.
 * [https://github.com/AstraExt/astra-monitor]
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 * This file is an EDID (Extended Display Identification Data) parser.
 * It converts raw EDID data (in hex string form) into a JavaScript/TypeScript
 * object describing the monitor's capabilities and information such as:
 *   - Manufacturer information
 *   - Serial number
 *   - Display size
 *   - Chromaticity coordinates
 *   - Timing and extension blocks
 *   - Model name
 * and more.
 *
 * This TypeScript version adds:
 *  - Model name parsing (after DTDs)
 *  - Unified EISA + PnP data
 *  - A class-based API (EdidParser) with a static parseEdid() method
 *  - The returned object is a plain data structure with the EDID breakdown
 *
 * See the original JS code for inline explanations of parsing logic and comments.
 */

//////////////////////////////////////
// Combined EISA + PnP manufacturer data
//////////////////////////////////////

/**
 * Combined EISA + PnP manufacturer data
 */
const combinedManufacturerData: Record<string, { fullName: string; name: string }> = {
    ACI: { fullName: 'Asus (ASUSTeK Computer Inc.)', name: 'Asus' },
    ACR: { fullName: 'Acer America Corp.', name: 'Acer' },
    ACT: { fullName: 'Targa', name: 'Targa' },
    ADI: { fullName: 'ADI Corporation http://www.adi.com.tw', name: 'ADI Corporation' },
    AMW: { fullName: 'AMW', name: 'AMW' },
    AOC: { fullName: 'AOC International (USA) Ltd.', name: 'AOC' },
    API: { fullName: 'Acer America Corp.', name: 'Acer' },
    APP: { fullName: 'Apple Computer, Inc.', name: 'Apple' },
    ART: { fullName: 'ArtMedia', name: 'ArtMedia' },
    AST: { fullName: 'AST Research', name: 'AST Research' },
    AUO: { fullName: 'AU Optronics', name: 'AU Optronics' },
    BMM: { fullName: 'BMM', name: 'BMM' },
    BNQ: { fullName: 'BenQ Corporation', name: 'BenQ' },
    BOE: { fullName: 'BOE Display Technology', name: 'BOE Display Technology' },
    CPL: { fullName: 'Compal Electronics, Inc. / ALFA', name: 'Compal Electronics' },
    CPQ: { fullName: 'COMPAQ Computer Corp.', name: 'COMPAQ' },
    CTX: { fullName: 'CTX – Chuntex Electronic Co.', name: 'CTX' },
    DEC: { fullName: 'Digital Equipment Corporation', name: 'Digital Equipment Corporation' },
    DEL: { fullName: 'Dell Computer Corp.', name: 'Dell' },
    DPC: { fullName: 'Delta Electronics, Inc.', name: 'Delta Electronics' },
    DWE: { fullName: 'Daewoo Telecom Ltd', name: 'Daewoo Telecom' },
    ECS: { fullName: 'ELITEGROUP Computer Systems', name: 'ELITEGROUP Computer Systems' },
    EIZ: { fullName: 'EIZO', name: 'EIZO' },
    EPI: { fullName: 'Envision Peripherals, Inc.', name: 'Envision Peripherals' },
    FCM: { fullName: 'Funai Electric Company of Taiwan', name: 'Funai Electric Company' },
    FUS: { fullName: 'Fujitsu Siemens', name: 'Fujitsu Siemens' },
    GSM: { fullName: 'LG Electronics Inc. (GoldStar Technology, Inc.)', name: 'LG' },
    GWY: { fullName: 'Gateway 2000', name: 'Gateway 2000' },
    HEI: { fullName: 'Hyundai Electronics Industries Co., Ltd.', name: 'Hyundai' },
    HIQ: { fullName: 'Hyundai ImageQuest', name: 'Hyundai' },
    HIT: { fullName: 'Hitachi', name: 'Hitachi' },
    HSD: { fullName: 'Hannspree Inc', name: 'Hannspree' },
    HSL: { fullName: 'Hansol Electronics', name: 'Hansol' },
    HTC: { fullName: 'Hitachi Ltd. / Nissei Sangyo America Ltd.', name: 'Hitachi' },
    HWP: { fullName: 'Hewlett Packard', name: 'HP' },
    IBM: { fullName: 'IBM PC Company', name: 'IBM' },
    ICL: { fullName: 'Fujitsu ICL', name: 'Fujitsu' },
    IFS: { fullName: 'InFocus', name: 'InFocus' },
    IQT: { fullName: 'Hyundai', name: 'Hyundai' },
    IVM: { fullName: 'Idek Iiyama North America, Inc.', name: 'Iiyama' },
    KDS: { fullName: 'KDS USA', name: 'KDS' },
    KFC: { fullName: 'KFC Computek', name: 'KFC Computek' },
    LEN: { fullName: 'Lenovo', name: 'Lenovo' },
    LGD: { fullName: 'LG Display', name: 'LG' },
    LKM: { fullName: 'ADLAS / AZALEA', name: 'ADLAS / AZALEA' },
    LNK: { fullName: 'LINK Technologies, Inc.', name: 'LINK Technologies' },
    LPL: { fullName: 'LG Philips', name: 'LG Philips' },
    LTN: { fullName: 'Lite-On', name: 'Lite-On' },
    MAG: { fullName: 'MAG InnoVision', name: 'MAG InnoVision' },
    MAX: { fullName: 'Maxdata Computer GmbH', name: 'Maxdata' },
    MEI: { fullName: 'Panasonic Comm. & Systems Co.', name: 'Panasonic' },
    MEL: { fullName: 'Mitsubishi Electronics', name: 'Mitsubishi' },
    MIR: { fullName: 'miro Computer Products AG', name: 'miro Computer Products' },
    MTC: { fullName: 'MITAC', name: 'MITAC' },
    NAN: { fullName: 'NANAO', name: 'NANAO' },
    NEC: { fullName: 'NEC Technologies, Inc.', name: 'NEC' },
    NOK: { fullName: 'Nokia', name: 'Nokia' },
    NOV: { fullName: 'Novastar', name: 'Novastar' },
    NVD: { fullName: 'Nvidia', name: 'Nvidia' },
    OQI: { fullName: 'OPTIQUEST', name: 'OPTIQUEST' },
    PBN: { fullName: 'Packard Bell', name: 'Packard Bell' },
    PCK: { fullName: 'Daewoo', name: 'Daewoo' },
    PDC: { fullName: 'Polaroid', name: 'Polaroid' },
    PGS: { fullName: 'Princeton Graphic Systems', name: 'Princeton Graphic Systems' },
    PHL: { fullName: 'Philips Consumer Electronics Co.', name: 'Philips' },
    PRT: { fullName: 'Princeton', name: 'Princeton' },
    REL: { fullName: 'Relisys', name: 'Relisys' },
    SAM: { fullName: 'Samsung', name: 'Samsung' },
    SEC: { fullName: 'Seiko Epson Corporation', name: 'Seiko Epson' },
    SMI: { fullName: 'Smile', name: 'Smile' },
    SMC: { fullName: 'Samtron', name: 'Samtron' },
    SNI: { fullName: 'Siemens Nixdorf', name: 'Siemens' },
    SNY: { fullName: 'Sony Corporation', name: 'Sony' },
    SPT: { fullName: 'Sceptre', name: 'Sceptre' },
    SRC: { fullName: 'Shamrock Technology', name: 'Shamrock Technology' },
    STN: { fullName: 'Samtron', name: 'Samtron' },
    STP: { fullName: 'Sceptre', name: 'Sceptre' },
    TAT: { fullName: 'Tatung Co. of America, Inc.', name: 'Tatung' },
    TRL: { fullName: 'Royal Information Company', name: 'Royal Information Company' },
    TSB: { fullName: 'Toshiba, Inc.', name: 'Toshiba' },
    UNM: { fullName: 'Unisys Corporation', name: 'Unisys Corporation' },
    VSC: { fullName: 'ViewSonic Corporation', name: 'ViewSonic' },
    WTC: { fullName: 'Wen Technology', name: 'Wen Technology' },
    ZCM: { fullName: 'Zenith Data Systems', name: 'Zenith Data System' },
    HPA: { fullName: 'ZYTOR COMMUNICATIONS', name: 'ZYTOR COMMUNICATIONS' },
    ZTC: { fullName: 'ZYDAS TECHNOLOGY CORPORATION', name: 'ZYDAS TECHNOLOGY CORPORATION' },
    ZYP: { fullName: 'ZYPCOM INC', name: 'ZYPCOM INC' },
    ZYT: { fullName: 'ZYTEX COMPUTERS', name: 'ZYTEX COMPUTERS' },
    ZYX: { fullName: 'ZYXEL', name: 'ZYXEL' },
    TTL: { fullName: '2-TEL B.V', name: '2-TEL B.V' },
    BUT: { fullName: '21ST CENTURY ENTERTAINMENT', name: '21ST CENTURY ENTERTAINMENT' },
    TCM: { fullName: '3COM CORPORATION', name: '3COM CORPORATION' },
    TDP: { fullName: '3D PERCEPTION', name: '3D PERCEPTION' },
    VSD: { fullName: '3M', name: '3M' },
    SIX: { fullName: 'ZUNIQ DATA CORPORATION', name: 'ZUNIQ DATA CORPORATION' },
    ZYD: { fullName: 'ZYDACRON INC', name: 'ZYDACRON INC' },
    NOD: { fullName: '3NOD DIGITAL TECHNOLOGY CO. LTD.', name: '3NOD DIGITAL TECHNOLOGY CO. LTD.' },
    NGS: { fullName: 'A D S EXPORTS', name: 'A D S EXPORTS' },
    ACG: { fullName: 'A&R CAMBRIDGE LTD.', name: 'A&R CAMBRIDGE LTD.' },
    APV: { fullName: 'A+V LINK', name: 'A+V LINK' },
    AVX: { fullName: 'A/VAUX ELECTRONICS', name: 'A/VAUX ELECTRONICS' },
    AAN: { fullName: 'AAEON TECHNOLOGY INC.', name: 'AAEON TECHNOLOGY INC.' },
    TRU: { fullName: 'AASHIMA TECHNOLOGY B.V.', name: 'AASHIMA TECHNOLOGY B.V.' },
    AAM: { fullName: 'AAVA MOBILE OY', name: 'AAVA MOBILE OY' },
    GEH: { fullName: 'ABACO SYSTEMS, INC.', name: 'ABACO SYSTEMS, INC.' },
    ABS: { fullName: 'ABACO SYSTEMS, INC.', name: 'ABACO SYSTEMS, INC.' },
    ABA: { fullName: 'ABBAHOME INC.', name: 'ABBAHOME INC.' },
    MEG: { fullName: 'ABEAM TECH LTD.', name: 'ABEAM TECH LTD.' },
    ATC: { fullName: 'ABLY-TECH CORPORATION', name: 'ABLY-TECH CORPORATION' },
    ABC: { fullName: 'ABOCOM SYSTEM INC.', name: 'ABOCOM SYSTEM INC.' },
    AWC: { fullName: 'ACCESS WORKS COMM INC', name: 'ACCESS WORKS COMM INC' },
    PKA: { fullName: 'ACCO UK LTD.', name: 'ACCO UK LTD.' },
    ACC: { fullName: 'ACCTON TECHNOLOGY CORPORATION', name: 'ACCTON TECHNOLOGY CORPORATION' },
    ACU: { fullName: 'ACCULOGIC', name: 'ACCULOGIC' },
    ASL: { fullName: 'ACCUSCENE CORPORATION LTD', name: 'ACCUSCENE CORPORATION LTD' },
    ANT: { fullName: 'ACE CAD ENTERPRISE COMPANY LTD', name: 'ACE CAD ENTERPRISE COMPANY LTD' },
    CHE: { fullName: 'ACER INC', name: 'ACER INC' },
    ALI: { fullName: 'ACER LABS', name: 'ACER LABS' },
    ANX: { fullName: 'ACER NETXUS INC', name: 'ACER NETXUS INC' },
    ACK: { fullName: 'ACKSYS', name: 'ACKSYS' },
    ADC: { fullName: 'ACNHOR DATACOMM', name: 'ACNHOR DATACOMM' },
    CAL: { fullName: 'ACON', name: 'ACON' },
    ALK: { fullName: 'ACROLINK INC', name: 'ACROLINK INC' },
    ACM: {
        fullName: 'ACROLOOP MOTION CONTROL SYSTEMS INC',
        name: 'ACROLOOP MOTION CONTROL SYSTEMS INC',
    },
    LAB: { fullName: 'ACT LABS LTD', name: 'ACT LABS LTD' },
    ACE: { fullName: 'ACTEK ENGINEERING PTY LTD', name: 'ACTEK ENGINEERING PTY LTD' },
    AEI: { fullName: 'ACTIONTEC ELECTRIC INC', name: 'ACTIONTEC ELECTRIC INC' },
    ACV: { fullName: 'ACTIVCARD S.A', name: 'ACTIVCARD S.A' },
    ACB: { fullName: 'ACULAB LTD', name: 'ACULAB LTD' },
    ALM: { fullName: 'ACUTEC LTD.', name: 'ACUTEC LTD.' },
    GLE: { fullName: 'AD ELECTRONICS', name: 'AD ELECTRONICS' },
    ADM: { fullName: 'AD LIB MULTIMEDIA INC', name: 'AD LIB MULTIMEDIA INC' },
    ADP: { fullName: 'ADAPTEC INC', name: 'ADAPTEC INC' },
    ADX: { fullName: 'ADAX INC', name: 'ADAX INC' },
    RSH: { fullName: 'ADC-CENTRE', name: 'ADC-CENTRE' },
    AVE: {
        fullName: 'ADD VALUE ENTERPISES (ASIA) PTE LTD',
        name: 'ADD VALUE ENTERPISES (ASIA) PTE LTD',
    },
    ADZ: { fullName: 'ADDER TECHNOLOGY LTD', name: 'ADDER TECHNOLOGY LTD' },
    ADA: { fullName: 'ADDI-DATA GMBH', name: 'ADDI-DATA GMBH' },
    DPM: { fullName: 'ADPM SYNTHESIS SAS', name: 'ADPM SYNTHESIS SAS' },
    AXB: { fullName: 'ADRIENNE ELECTRONICS CORPORATION', name: 'ADRIENNE ELECTRONICS CORPORATION' },
    ADT: { fullName: 'ADTEK', name: 'ADTEK' },
    ADK: { fullName: 'ADTEK SYSTEM SCIENCE COMPANY LTD', name: 'ADTEK SYSTEM SCIENCE COMPANY LTD' },
    FLE: { fullName: 'ADTI MEDIA, INC', name: 'ADTI MEDIA, INC' },
    AND: { fullName: 'ADTRAN INC', name: 'ADTRAN INC' },
    AGM: { fullName: "ADVAN INT'L CORPORATION", name: "ADVAN INT'L CORPORATION" },
    AVN: { fullName: 'ADVANCE COMPUTER CORPORATION', name: 'ADVANCE COMPUTER CORPORATION' },
    MSM: { fullName: 'ADVANCED DIGITAL SYSTEMS', name: 'ADVANCED DIGITAL SYSTEMS' },
    AED: {
        fullName: 'ADVANCED ELECTRONIC DESIGNS, INC.',
        name: 'ADVANCED ELECTRONIC DESIGNS, INC.',
    },
    RJS: { fullName: 'ADVANCED ENGINEERING', name: 'ADVANCED ENGINEERING' },
    GRV: { fullName: 'ADVANCED GRAVIS', name: 'ADVANCED GRAVIS' },
    AIR: { fullName: 'ADVANCED INTEG. RESEARCH INC', name: 'ADVANCED INTEG. RESEARCH INC' },
    ALR: { fullName: 'ADVANCED LOGIC', name: 'ADVANCED LOGIC' },
    ADV: { fullName: 'ADVANCED MICRO DEVICES INC', name: 'ADVANCED MICRO DEVICES INC' },
    EVE: { fullName: 'ADVANCED MICRO PERIPHERALS LTD', name: 'ADVANCED MICRO PERIPHERALS LTD' },
    AOE: {
        fullName: 'ADVANCED OPTICS ELECTRONICS, INC.',
        name: 'ADVANCED OPTICS ELECTRONICS, INC.',
    },
    ADD: { fullName: 'ADVANCED PERIPHERAL DEVICES INC', name: 'ADVANCED PERIPHERAL DEVICES INC' },
    ABV: { fullName: 'ADVANCED RESEARCH TECHNOLOGY', name: 'ADVANCED RESEARCH TECHNOLOGY' },
    PSA: {
        fullName: 'ADVANCED SIGNAL PROCESSING TECHNOLOGIES',
        name: 'ADVANCED SIGNAL PROCESSING TECHNOLOGIES',
    },
    AHC: { fullName: 'ADVANTECH CO., LTD.', name: 'ADVANTECH CO., LTD.' },
    ADH: { fullName: 'AERODATA HOLDINGS LTD', name: 'AERODATA HOLDINGS LTD' },
    AEP: { fullName: 'AETAS PERIPHERAL INTERNATIONAL', name: 'AETAS PERIPHERAL INTERNATIONAL' },
    AET: { fullName: 'AETHRA TELECOMUNICAZIONI S.R.L.', name: 'AETHRA TELECOMUNICAZIONI S.R.L.' },
    CHS: { fullName: 'AGENTUR CHAIROS', name: 'AGENTUR CHAIROS' },
    AGT: { fullName: 'AGILENT TECHNOLOGIES', name: 'AGILENT TECHNOLOGIES' },
    ASI: { fullName: 'AHEAD SYSTEMS', name: 'AHEAD SYSTEMS' },
    AIM: { fullName: 'AIMS LAB INC', name: 'AIMS LAB INC' },
    AYR: { fullName: 'AIRLIB, INC', name: 'AIRLIB, INC' },
    AWL: {
        fullName: 'AIRONET WIRELESS COMMUNICATIONS, INC',
        name: 'AIRONET WIRELESS COMMUNICATIONS, INC',
    },
    AIW: { fullName: 'AIWA COMPANY LTD', name: 'AIWA COMPANY LTD' },
    AJA: { fullName: 'AJA VIDEO SYSTEMS, INC.', name: 'AJA VIDEO SYSTEMS, INC.' },
    AKE: { fullName: 'AKAMI ELECTRIC CO.,LTD', name: 'AKAMI ELECTRIC CO.,LTD' },
    AKB: { fullName: 'AKEBIA LTD', name: 'AKEBIA LTD' },
    AKI: { fullName: 'AKIA CORPORATION', name: 'AKIA CORPORATION' },
    ALH: { fullName: 'AL SYSTEMS', name: 'AL SYSTEMS' },
    ALA: { fullName: 'ALACRON INC', name: 'ALACRON INC' },
    ALN: { fullName: 'ALANA TECHNOLOGIES', name: 'ALANA TECHNOLOGIES' },
    AOT: { fullName: 'ALCATEL', name: 'ALCATEL' },
    ABE: { fullName: 'ALCATEL BELL', name: 'ALCATEL BELL' },
    ADB: { fullName: 'ALDEBBARON', name: 'ALDEBBARON' },
    ALE: { fullName: 'ALENCO BV', name: 'ALENCO BV' },
    ALX: { fullName: 'ALEXON CO.,LTD.', name: 'ALEXON CO.,LTD.' },
    AFA: { fullName: 'ALFA INC', name: 'ALFA INC' },
    ALO: { fullName: 'ALGOLITH INC.', name: 'ALGOLITH INC.' },
    AGO: { fullName: 'ALGOLTEK, INC.', name: 'ALGOLTEK, INC.' },
    AIS: { fullName: 'ALIEN INTERNET SERVICES', name: 'ALIEN INTERNET SERVICES' },
    ABD: { fullName: 'ALLEN BRADLEY COMPANY', name: 'ALLEN BRADLEY COMPANY' },
    ALL: {
        fullName: 'ALLIANCE SEMICONDUCTOR CORPORATION',
        name: 'ALLIANCE SEMICONDUCTOR CORPORATION',
    },
    ATI: { fullName: 'ALLIED TELESIS KK', name: 'ALLIED TELESIS KK' },
    ATK: { fullName: "ALLIED TELESYN INT'L", name: "ALLIED TELESYN INT'L" },
    ATA: {
        fullName: 'ALLIED TELESYN INTERNATIONAL (ASIA) PTE LTD',
        name: 'ALLIED TELESYN INTERNATIONAL (ASIA) PTE LTD',
    },
    ACO: { fullName: 'ALLION COMPUTER INC.', name: 'ALLION COMPUTER INC.' },
    XAD: { fullName: 'ALPHA DATA', name: 'ALPHA DATA' },
    AEJ: { fullName: 'ALPHA ELECTRONICS COMPANY', name: 'ALPHA ELECTRONICS COMPANY' },
    ATD: { fullName: 'ALPHA TELECOM INC', name: 'ALPHA TELECOM INC' },
    ATP: { fullName: 'ALPHA-TOP CORPORATION', name: 'ALPHA-TOP CORPORATION' },
    ALV: { fullName: 'ALPHAVIEW LCD', name: 'ALPHAVIEW LCD' },
    APE: { fullName: 'ALPINE ELECTRONICS, INC.', name: 'ALPINE ELECTRONICS, INC.' },
    ALP: { fullName: 'ALPS ELECTRIC COMPANY LTD', name: 'ALPS ELECTRIC COMPANY LTD' },
    AUI: { fullName: 'ALPS ELECTRIC INC', name: 'ALPS ELECTRIC INC' },
    ARC: { fullName: 'ALTA RESEARCH CORPORATION', name: 'ALTA RESEARCH CORPORATION' },
    ALC: { fullName: 'ALTEC CORPORATION', name: 'ALTEC CORPORATION' },
    ALJ: { fullName: 'ALTEC LANSING', name: 'ALTEC LANSING' },
    AIX: { fullName: 'ALTINEX, INC.', name: 'ALTINEX, INC.' },
    AIE: { fullName: 'ALTMANN INDUSTRIEELEKTRONIK', name: 'ALTMANN INDUSTRIEELEKTRONIK' },
    ACS: { fullName: 'ALTOS COMPUTER SYSTEMS', name: 'ALTOS COMPUTER SYSTEMS' },
    AIL: { fullName: 'ALTOS INDIA LTD', name: 'ALTOS INDIA LTD' },
    ALT: { fullName: 'ALTRA', name: 'ALTRA' },
    CNC: { fullName: 'ALVEDON COMPUTERS LTD', name: 'ALVEDON COMPUTERS LTD' },
    AMB: { fullName: 'AMBIENT TECHNOLOGIES, INC.', name: 'AMBIENT TECHNOLOGIES, INC.' },
    AMD: { fullName: 'AMDEK CORPORATION', name: 'AMDEK CORPORATION' },
    AOL: { fullName: 'AMERICA ONLINE', name: 'AMERICA ONLINE' },
    YOW: { fullName: 'AMERICAN BIOMETRIC COMPANY', name: 'AMERICAN BIOMETRIC COMPANY' },
    AXP: { fullName: 'AMERICAN EXPRESS', name: 'AMERICAN EXPRESS' },
    AXI: { fullName: 'AMERICAN MAGNETICS', name: 'AMERICAN MAGNETICS' },
    AMI: { fullName: 'AMERICAN MEGATRENDS INC', name: 'AMERICAN MEGATRENDS INC' },
    MCA: { fullName: 'AMERICAN NUCLEAR SYSTEMS INC', name: 'AMERICAN NUCLEAR SYSTEMS INC' },
    CNB: { fullName: 'AMERICAN POWER CONVERSION', name: 'AMERICAN POWER CONVERSION' },
    APC: { fullName: 'AMERICAN POWER CONVERSION', name: 'AMERICAN POWER CONVERSION' },
    AMN: { fullName: 'AMIMON LTD.', name: 'AMIMON LTD.' },
    AMO: {
        fullName: 'AMINO TECHNOLOGIES PLC AND AMINO COMMUNICATIONS LIMITED',
        name: 'AMINO TECHNOLOGIES PLC AND AMINO COMMUNICATIONS LIMITED',
    },
    AKL: { fullName: 'AMIT LTD', name: 'AMIT LTD' },
    AMP: { fullName: 'AMP INC', name: 'AMP INC' },
    AII: { fullName: 'AMPTRON INTERNATIONAL INC.', name: 'AMPTRON INTERNATIONAL INC.' },
    AMT: { fullName: 'AMT INTERNATIONAL INDUSTRY', name: 'AMT INTERNATIONAL INDUSTRY' },
    AMR: { fullName: 'AMTRAN TECHNOLOGY CO., LTD.', name: 'AMTRAN TECHNOLOGY CO., LTD.' },
    AMX: { fullName: 'AMX LLC', name: 'AMX LLC' },
    BBB: { fullName: 'AN-NAJAH UNIVERSITY', name: 'AN-NAJAH UNIVERSITY' },
    ANA: { fullName: 'ANAKRON', name: 'ANAKRON' },
    ADN: {
        fullName: 'ANALOG & DIGITAL DEVICES TEL. INC',
        name: 'ANALOG & DIGITAL DEVICES TEL. INC',
    },
    ADS: { fullName: 'ANALOG DEVICES INC', name: 'ANALOG DEVICES INC' },
    ANW: { fullName: 'ANALOG WAY SAS', name: 'ANALOG WAY SAS' },
    ANL: { fullName: 'ANALOGIX SEMICONDUCTOR, INC', name: 'ANALOGIX SEMICONDUCTOR, INC' },
    AAE: { fullName: 'ANATEK ELECTRONICS INC.', name: 'ANATEK ELECTRONICS INC.' },
    ABT: { fullName: 'ANCHOR BAY TECHNOLOGIES, INC.', name: 'ANCHOR BAY TECHNOLOGIES, INC.' },
    ANC: { fullName: 'ANCOT', name: 'ANCOT' },
    AML: {
        fullName: 'ANDERSON MULTIMEDIA COMMUNICATIONS (HK) LIMITED',
        name: 'ANDERSON MULTIMEDIA COMMUNICATIONS (HK) LIMITED',
    },
    ANP: { fullName: 'ANDREW NETWORK PRODUCTION', name: 'ANDREW NETWORK PRODUCTION' },
    ANI: { fullName: 'ANIGMA INC', name: 'ANIGMA INC' },
    ANK: { fullName: 'ANKO ELECTRONIC COMPANY LTD', name: 'ANKO ELECTRONIC COMPANY LTD' },
    AAT: { fullName: 'ANN ARBOR TECHNOLOGIES', name: 'ANN ARBOR TECHNOLOGIES' },
    ANO: { fullName: 'ANORAD CORPORATION', name: 'ANORAD CORPORATION' },
    ANR: { fullName: 'ANR LTD', name: 'ANR LTD' },
    ANS: { fullName: 'ANSEL COMMUNICATION COMPANY', name: 'ANSEL COMMUNICATION COMPANY' },
    AEC: { fullName: 'ANTEX ELECTRONICS CORPORATION', name: 'ANTEX ELECTRONICS CORPORATION' },
    AOA: { fullName: 'AOPEN INC.', name: 'AOPEN INC.' },
    APX: { fullName: 'AP DESIGNS LTD', name: 'AP DESIGNS LTD' },
    DNG: { fullName: 'APACHE MICRO PERIPHERALS INC', name: 'APACHE MICRO PERIPHERALS INC' },
    APL: { fullName: 'APLICOM OY', name: 'APLICOM OY' },
    APN: { fullName: 'APPIAN TECH INC', name: 'APPIAN TECH INC' },
    APD: { fullName: 'APPLIADATA', name: 'APPLIADATA' },
    APM: { fullName: 'APPLIED MEMORY TECH', name: 'APPLIED MEMORY TECH' },
    ACL: { fullName: 'APRICOT COMPUTERS', name: 'APRICOT COMPUTERS' },
    APR: { fullName: 'APRILIA S.P.A.', name: 'APRILIA S.P.A.' },
    ATJ: { fullName: 'ARCHITEK CORPORATION', name: 'ARCHITEK CORPORATION' },
    ACH: { fullName: 'ARCHTEK TELECOM CORPORATION', name: 'ARCHTEK TELECOM CORPORATION' },
    ATL: { fullName: 'ARCUS TECHNOLOGY LTD', name: 'ARCUS TECHNOLOGY LTD' },
    ARD: { fullName: 'AREC INC.', name: 'AREC INC.' },
    ARS: { fullName: 'ARESCOM INC', name: 'ARESCOM INC' },
    AGL: { fullName: 'ARGOLIS', name: 'ARGOLIS' },
    ARI: { fullName: 'ARGOSY RESEARCH INC', name: 'ARGOSY RESEARCH INC' },
    ARG: { fullName: 'ARGUS ELECTRONICS CO., LTD', name: 'ARGUS ELECTRONICS CO., LTD' },
    ACA: { fullName: 'ARIEL CORPORATION', name: 'ARIEL CORPORATION' },
    ARM: { fullName: 'ARIMA', name: 'ARIMA' },
    ADE: { fullName: 'ARITHMOS, INC.', name: 'ARITHMOS, INC.' },
    ARK: { fullName: 'ARK LOGIC INC', name: 'ARK LOGIC INC' },
    ARL: { fullName: 'ARLOTTO COMNET INC', name: 'ARLOTTO COMNET INC' },
    AMS: { fullName: 'ARMSTEL, INC.', name: 'ARMSTEL, INC.' },
    AIC: {
        fullName: 'ARNOS INSTURMENTS & COMPUTER SYSTEMS',
        name: 'ARNOS INSTURMENTS & COMPUTER SYSTEMS',
    },
    ARR: { fullName: 'ARRIS GROUP, INC.', name: 'ARRIS GROUP, INC.' },
    IMB: { fullName: 'ART S.R.L.', name: 'ART S.R.L.' },
    AGI: { fullName: 'ARTISH GRAPHICS INC', name: 'ARTISH GRAPHICS INC' },
    NPA: { fullName: 'ARVANICS', name: 'ARVANICS' },
    AKM: {
        fullName: 'ASAHI KASEI MICROSYSTEMS COMPANY LTD',
        name: 'ASAHI KASEI MICROSYSTEMS COMPANY LTD',
    },
    ASN: { fullName: 'ASANTE TECH INC', name: 'ASANTE TECH INC' },
    HER: { fullName: 'ASCOM BUSINESS SYSTEMS', name: 'ASCOM BUSINESS SYSTEMS' },
    ASC: { fullName: 'ASCOM STRATEGIC TECHNOLOGY UNIT', name: 'ASCOM STRATEGIC TECHNOLOGY UNIT' },
    ASM: { fullName: 'ASEM S.P.A.', name: 'ASEM S.P.A.' },
    AEM: { fullName: 'ASEM S.P.A.', name: 'ASEM S.P.A.' },
    ASE: { fullName: 'ASEV DISPLAY LABS', name: 'ASEV DISPLAY LABS' },
    ASH: { fullName: 'ASHTON BENTLEY CONCEPTS', name: 'ASHTON BENTLEY CONCEPTS' },
    AMA: {
        fullName: 'ASIA MICROELECTRONIC DEVELOPMENT INC',
        name: 'ASIA MICROELECTRONIC DEVELOPMENT INC',
    },
    ASK: { fullName: 'ASK A/S', name: 'ASK A/S' },
    DYN: { fullName: 'ASKEY COMPUTER CORPORATION', name: 'ASKEY COMPUTER CORPORATION' },
    AKY: { fullName: 'ASKEY COMPUTER CORPORATION', name: 'ASKEY COMPUTER CORPORATION' },
    ASP: { fullName: 'ASP MICROELECTRONICS LTD', name: 'ASP MICROELECTRONICS LTD' },
    ACP: { fullName: 'ASPEN TECH INC', name: 'ASPEN TECH INC' },
    JAC: { fullName: 'ASTEC INC', name: 'ASTEC INC' },
    ADL: { fullName: 'ASTRA SECURITY PRODUCTS LTD', name: 'ASTRA SECURITY PRODUCTS LTD' },
    ATO: { fullName: 'ASTRO DESIGN, INC.', name: 'ASTRO DESIGN, INC.' },
    AHQ: { fullName: 'ASTRO HQ LLC', name: 'ASTRO HQ LLC' },
    ASU: { fullName: 'ASUSCOM NETWORK INC', name: 'ASUSCOM NETWORK INC' },
    AUS: { fullName: 'ASUSTEK COMPUTER INC', name: 'ASUSTEK COMPUTER INC' },
    ATT: { fullName: 'AT&T', name: 'AT&T' },
    GIS: { fullName: 'AT&T GLOBAL INFO SOLUTIONS', name: 'AT&T GLOBAL INFO SOLUTIONS' },
    HSM: { fullName: 'AT&T MICROELECTRONICS', name: 'AT&T MICROELECTRONICS' },
    TME: { fullName: 'AT&T MICROELECTRONICS', name: 'AT&T MICROELECTRONICS' },
    PDN: { fullName: 'AT&T PARADYNE', name: 'AT&T PARADYNE' },
    AVJ: { fullName: 'ATELIER VISION CORPORATION', name: 'ATELIER VISION CORPORATION' },
    ATH: { fullName: 'ATHENA INFORMATICA S.R.L.', name: 'ATHENA INFORMATICA S.R.L.' },
    ATN: { fullName: 'ATHENA SMARTCARD SOLUTIONS LTD.', name: 'ATHENA SMARTCARD SOLUTIONS LTD.' },
    ATX: { fullName: 'ATHENIX CORPORATION', name: 'ATHENIX CORPORATION' },
    BUJ: { fullName: 'ATI TECH INC', name: 'ATI TECH INC' },
    CFG: { fullName: 'ATLANTIS', name: 'ATLANTIS' },
    ATM: { fullName: 'ATM LTD', name: 'ATM LTD' },
    AKP: { fullName: 'ATOM KOMPLEX PRYLAD', name: 'ATOM KOMPLEX PRYLAD' },
    AMC: { fullName: 'ATTACHMATE CORPORATION', name: 'ATTACHMATE CORPORATION' },
    FWA: { fullName: 'ATTERO TECH, LLC', name: 'ATTERO TECH, LLC' },
    APT: { fullName: 'AUDIO PROCESSING TECHNOLOGY LTD', name: 'AUDIO PROCESSING TECHNOLOGY LTD' },
    ASX: { fullName: 'AUDIOSCIENCE', name: 'AUDIOSCIENCE' },
    AUG: { fullName: 'AUGUST HOME, INC.', name: 'AUGUST HOME, INC.' },
    AVC: { fullName: 'AURAVISION CORPORATION', name: 'AURAVISION CORPORATION' },
    AUR: { fullName: 'AUREAL SEMICONDUCTOR', name: 'AUREAL SEMICONDUCTOR' },
    APS: { fullName: 'AUTOLOGIC INC', name: 'AUTOLOGIC INC' },
    CLT: {
        fullName: 'AUTOMATED COMPUTER CONTROL SYSTEMS',
        name: 'AUTOMATED COMPUTER CONTROL SYSTEMS',
    },
    AUT: { fullName: 'AUTOTIME CORPORATION', name: 'AUTOTIME CORPORATION' },
    AUV: { fullName: 'AUVIDEA GMBH', name: 'AUVIDEA GMBH' },
    AVL: { fullName: 'AVALUE TECHNOLOGY INC.', name: 'AVALUE TECHNOLOGY INC.' },
    ALS: { fullName: 'AVANCE LOGIC INC', name: 'AVANCE LOGIC INC' },
    AVS: { fullName: 'AVATRON SOFTWARE INC.', name: 'AVATRON SOFTWARE INC.' },
    AVA: { fullName: 'AVAYA COMMUNICATION', name: 'AVAYA COMMUNICATION' },
    AVG: { fullName: 'AVEGANT CORPORATION', name: 'AVEGANT CORPORATION' },
    AEN: { fullName: 'AVENCALL', name: 'AVENCALL' },
    AVR: { fullName: 'AVER INFORMATION INC.', name: 'AVER INFORMATION INC.' },
    AVD: { fullName: 'AVID ELECTRONICS CORPORATION', name: 'AVID ELECTRONICS CORPORATION' },
    AVM: { fullName: 'AVM GMBH', name: 'AVM GMBH' },
    AVO: { fullName: 'AVOCENT CORPORATION', name: 'AVOCENT CORPORATION' },
    AAA: { fullName: 'AVOLITES LTD', name: 'AVOLITES LTD' },
    AVT: { fullName: 'AVTEK (ELECTRONICS) PTY LTD', name: 'AVTEK (ELECTRONICS) PTY LTD' },
    ACD: { fullName: 'AWETA BV', name: 'AWETA BV' },
    AXL: { fullName: 'AXEL', name: 'AXEL' },
    AXE: { fullName: 'AXELL CORPORATION', name: 'AXELL CORPORATION' },
    AXC: { fullName: 'AXIOMTEK CO., LTD.', name: 'AXIOMTEK CO., LTD.' },
    AXO: { fullName: 'AXONIC LABS LLC', name: 'AXONIC LABS LLC' },
    AXT: { fullName: 'AXTEND TECHNOLOGIES INC', name: 'AXTEND TECHNOLOGIES INC' },
    AXX: { fullName: 'AXXON COMPUTER CORPORATION', name: 'AXXON COMPUTER CORPORATION' },
    AXY: { fullName: 'AXYZ AUTOMATION SERVICES, INC', name: 'AXYZ AUTOMATION SERVICES, INC' },
    AYD: { fullName: 'AYDIN DISPLAYS', name: 'AYDIN DISPLAYS' },
    AZM: { fullName: 'AZ MIDDELHEIM - RADIOTHERAPY', name: 'AZ MIDDELHEIM - RADIOTHERAPY' },
    AZT: { fullName: 'AZTECH SYSTEMS LTD', name: 'AZTECH SYSTEMS LTD' },
    BBH: { fullName: 'B&BH', name: 'B&BH' },
    SMR: { fullName: 'B.& V. S.R.L.', name: 'B.& V. S.R.L.' },
    BFE: { fullName: 'B.F. ENGINEERING CORPORATION', name: 'B.F. ENGINEERING CORPORATION' },
    BUG: { fullName: 'B.U.G., INC.', name: 'B.U.G., INC.' },
    BNO: { fullName: 'BANG & OLUFSEN', name: 'BANG & OLUFSEN' },
    BNK: { fullName: 'BANKSIA TECH PTY LTD', name: 'BANKSIA TECH PTY LTD' },
    BAN: { fullName: 'BANYAN', name: 'BANYAN' },
    BRC: { fullName: 'BARC', name: 'BARC' },
    BDS: { fullName: 'BARCO DISPLAY SYSTEMS', name: 'BARCO DISPLAY SYSTEMS' },
    BCD: { fullName: 'BARCO GMBH', name: 'BARCO GMBH' },
    BGB: { fullName: 'BARCO GRAPHICS N.V', name: 'BARCO GRAPHICS N.V' },
    BPS: { fullName: 'BARCO, N.V.', name: 'BARCO, N.V.' },
    DDS: { fullName: 'BARCO, N.V.', name: 'BARCO, N.V.' },
    BEO: { fullName: 'BAUG & OLUFSEN', name: 'BAUG & OLUFSEN' },
    BCC: { fullName: 'BEAVER COMPUTER CORPORATON', name: 'BEAVER COMPUTER CORPORATON' },
    BEC: { fullName: 'BECKHOFF AUTOMATION', name: 'BECKHOFF AUTOMATION' },
    BEI: { fullName: 'BECKWORTH ENTERPRISES INC', name: 'BECKWORTH ENTERPRISES INC' },
    LHC: {
        fullName: 'BEIHAI CENTURY JOINT INNOVATION TECHNOLOGY CO.,LTD',
        name: 'BEIHAI CENTURY JOINT INNOVATION TECHNOLOGY CO.,LTD',
    },
};

//////////////////////////////////////
// Convert EISA ID integer to a 3-letter code
//////////////////////////////////////

function intToAscii(intCode: number): string | undefined {
    const abc = '0ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    // This function returns e.g. "A" for 1, "B" for 2, etc.
    // If intCode > 26, it might return undefined.
    return abc[intCode];
}

//////////////////////////////////////
// The main EDID parser class
//////////////////////////////////////

class Edid {
    // PUBLIC data from parsing
    public edidData: number[] = [];
    public validHeader?: 'OK' | 'ERROR';
    public displaySize?: [number, number] | null;
    public eisaId?: string;
    public productCode?: number;
    public serialNumber?: string | number;
    public manufactureDate?: string;
    public edidVersion?: string;
    public bdp?: any;
    public chromaticity?: any;
    public timingBitmap?: number;
    public standardDisplayModes?: any[];
    public dtds?: any[];
    public numberOfExtensions?: number;
    public checksum?: number;
    public exts?: any[];
    public modelName?: string;

    // Constants
    public EDID_BLOCK_LENGTH = 128;
    public WhiteAndSyncLevels = ['+0.7/−0.3 V', '+0.714/−0.286 V', '+1.0/−0.4 V', '+0.7/0 V'];
    public digitalColorSpace = [
        'RGB 4:4:4',
        'RGB 4:4:4 + YCrCb 4:4:4',
        'RGB 4:4:4 + YCrCb 4:2:2',
        'RGB 4:4:4 + YCrCb 4:4:4 + YCrCb 4:2:2',
    ];
    public analogColorSpace = [
        'Monochrome or Grayscale',
        'RGB color',
        'Non-RGB color',
        'Undefined',
    ];
    public establishedTimingBitmaps = [
        '720×400 @ 70 Hz',
        '720×400 @ 88 Hz',
        '640×480 @ 60 Hz',
        '640×480 @ 67 Hz',
        '640×480 @ 72 Hz',
        '640×480 @ 75 Hz',
        '800×600 @ 56 Hz',
        '800×600 @ 60 Hz',
        '800×600 @ 72 Hz',
        '800×600 @ 75 Hz',
        '832×624 @ 75 Hz',
        '1024×768i @ 87 Hz',
        '1024×768 @ 60 Hz',
        '1024×768 @ 72 Hz',
        '1024×768 @ 75 Hz',
        '1280×1024 @ 75 Hz',
        '1152x870 @ 75 Hz',
    ];
    public DTD_LENGTH = 18;

    public xyPixelRatioEnum = [
        { string: '16:10' },
        { string: '4:3' },
        { string: '5:4' },
        { string: '16:9' },
    ];

    public syncTypeEnum = {
        ANALOG_COMPOSITE: 0x00,
        BIPOLAR_ANALOG_COMPOSITE: 0x01,
        DIGITAL_COMPOSITE: 0x02,
        DIGITAL_SEPARATE: 0x03,
    };

    public dataBlockType = {
        RESERVED: { string: 'RESERVED', value: 0 },
        AUDIO: { string: 'AUDIO', value: 1 },
        VIDEO: { string: 'VIDEO', value: 2 },
        VENDOR_SPECIFIC: { string: 'VENDOR SPECIFIC', value: 3 },
        SPEAKER_ALLOCATION: { string: 'SPEAKER ALLOCATION', value: 4 },
        EXTENDED_TAG: { string: 'EXTENDED TAG', value: 7 },
    };

    public extendedDataBlockType = {
        VIDEO_CAPABILITY: { string: 'VIDEO CAPABILITY', value: 0 },
        COLORIMETRY: { string: 'COLORIMETRY', value: 5 },
        YCBCR420_VIDEO: { string: 'YCBCR420 VIDEO DATA', value: 14 },
        YCBCR420_CAPABILITY_MAP: { string: 'YCBCR420_CAPABILITY_MAP', value: 15 },
    };

    public ieeeOuiType = {
        HDMI14: { string: 'HDMI14', value: 0x000c03 },
        HDMI20: { string: 'HDMI20', value: 0xc45dd8 },
    };

    public overscanBehavior = [
        'No data',
        'Always overscanned',
        'Always underscanned',
        'Supports both overscan and underscan',
    ];

    public audioFormatArray = [1, 8, 13, 14, 15];

    public shortAudioDescriptors = [
        'RESERVED',
        'LPCM',
        'AC-3',
        'MPEG-1',
        'MP3',
        'MPEG2',
        'AAC LC',
        'DTS',
        'ATRAC',
        'DSD',
        'E-AC-3',
        'DTS-HD',
        'MLP',
        'DST',
        'WMA Pro',
    ];

    public sadSampleRates = [
        '32 kHz',
        '44.1 kHz',
        '48 kHz',
        '88.2 kHz',
        '96 kHz',
        '176.4 kHz',
        '192 kHz',
    ];

    public sadBitDepths = ['16 bit', '20 bit', '24 bit'];

    public shortVideoDescriptors = [
        { vic: 0 },
        {
            vic: 1,
            format: '640x480p',
            fieldRate: '59.94Hz/60Hz',
            pictureAspectRatio: '4:3',
            pixelAspectRatio: '1:1',
        },
        {
            vic: 2,
            format: '720x480p',
            fieldRate: '59.94Hz/60Hz',
            pictureAspectRatio: '4:3',
            pixelAspectRatio: '8:9',
        },
        {
            vic: 3,
            format: '720x480p',
            fieldRate: '59.94Hz/60Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '32:27',
        },
        {
            vic: 4,
            format: '1280x720p',
            fieldRate: '59.94Hz/60Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '1:1',
        },
        {
            vic: 5,
            format: '1920x1080i',
            fieldRate: '59.94Hz/60Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '1:1',
        },
        {
            vic: 6,
            format: '720(1440)x480i',
            fieldRate: '59.94Hz/60Hz',
            pictureAspectRatio: '4:3',
            pixelAspectRatio: '8:9',
        },
        {
            vic: 7,
            format: '720(1440)x480i',
            fieldRate: '59.94Hz/60Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '32:27',
        },
        {
            vic: 8,
            format: '720(1440)x240p',
            fieldRate: '59.94Hz/60Hz',
            pictureAspectRatio: '4:3',
            pixelAspectRatio: '4:9',
        },
        {
            vic: 9,
            format: '720(1440)x240p',
            fieldRate: '59.94Hz/60Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '16:27',
        },
        {
            vic: 10,
            format: '2880x480i',
            fieldRate: '59.94Hz/60Hz',
            pictureAspectRatio: '4:3',
            pixelAspectRatio: '2:9 – 20:9',
        },
        {
            vic: 11,
            format: '2880x480i',
            fieldRate: '59.94Hz/60Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '8:27 -80:27',
        },
        {
            vic: 12,
            format: '2880x240p',
            fieldRate: '59.94Hz/60Hz',
            pictureAspectRatio: '4:3',
            pixelAspectRatio: '1:9 – 10:9',
        },
        {
            vic: 13,
            format: '2880x240p',
            fieldRate: '59.94Hz/60Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '4:27 – 40:27',
        },
        {
            vic: 14,
            format: '1440x480p',
            fieldRate: '59.94Hz/60Hz',
            pictureAspectRatio: '4:3',
            pixelAspectRatio: '4:9 or 8:9',
        },
        {
            vic: 15,
            format: '1440x480p',
            fieldRate: '59.94Hz/60Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '16:27 or 32:27',
        },
        {
            vic: 16,
            format: '1920x1080p',
            fieldRate: '59.94Hz/60Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '1:1',
        },
        {
            vic: 17,
            format: '720x576p',
            fieldRate: '50Hz',
            pictureAspectRatio: '4:3',
            pixelAspectRatio: '16:15',
        },
        {
            vic: 18,
            format: '720x576p',
            fieldRate: '50Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '64:45',
        },
        {
            vic: 19,
            format: '1280x720p',
            fieldRate: '50Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '1:1',
        },
        {
            vic: 20,
            format: '1920x1080i',
            fieldRate: '50Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '1:1',
        },
        {
            vic: 21,
            format: '720(1440)x576i',
            fieldRate: '50Hz',
            pictureAspectRatio: '4:3',
            pixelAspectRatio: '16:15',
        },
        {
            vic: 22,
            format: '720(1440)x576i',
            fieldRate: '50Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '64:45',
        },
        {
            vic: 23,
            format: '720(1440)x288p',
            fieldRate: '50Hz',
            pictureAspectRatio: '4:3',
            pixelAspectRatio: '8:15',
        },
        {
            vic: 24,
            format: '720(1440)x288p',
            fieldRate: '50Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '32:45',
        },
        {
            vic: 25,
            format: '2880x576i',
            fieldRate: '50Hz',
            pictureAspectRatio: '4:3',
            pixelAspectRatio: '2:15 – 20:15',
        },
        {
            vic: 26,
            format: '2880x576i',
            fieldRate: '50Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '16:45-160:45',
        },
        {
            vic: 27,
            format: '2880x288p',
            fieldRate: '50Hz',
            pictureAspectRatio: '4:3',
            pixelAspectRatio: '1:15 – 10:15',
        },
        {
            vic: 28,
            format: '2880x288p',
            fieldRate: '50Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '8:45 – 80:45',
        },
        {
            vic: 29,
            format: '1440x576p',
            fieldRate: '50Hz',
            pictureAspectRatio: '4:3',
            pixelAspectRatio: '8:15 or 16:15',
        },
        {
            vic: 30,
            format: '1440x576p',
            fieldRate: '50Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '32:45 or 64:45',
        },
        {
            vic: 31,
            format: '1920x1080p',
            fieldRate: '50Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '1:1',
        },
        {
            vic: 32,
            format: '1920x1080p',
            fieldRate: '23.97Hz/24Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '1:1',
        },
        {
            vic: 33,
            format: '1920x1080p',
            fieldRate: '25Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '1:1',
        },
        {
            vic: 34,
            format: '1920x1080p',
            fieldRate: '29.97Hz/30Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '1:1',
        },
        {
            vic: 35,
            format: '2880x480p',
            fieldRate: '59.94Hz/60Hz',
            pictureAspectRatio: '4:3',
            pixelAspectRatio: '2:9, 4:9, or 8:9',
        },
        {
            vic: 36,
            format: '2880x480p',
            fieldRate: '59.94Hz/60Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '8:27, 16:27, or 32:27',
        },
        {
            vic: 37,
            format: '2880x576p',
            fieldRate: '50Hz',
            pictureAspectRatio: '4:3',
            pixelAspectRatio: '4:15, 8:15, or 16:15',
        },
        {
            vic: 38,
            format: '2880x576p',
            fieldRate: '50Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '16:45, 32:45, or 64:45',
        },
        {
            vic: 39,
            format: '1920x1080i (1250 total)',
            fieldRate: '50Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '1:1',
        },
        {
            vic: 40,
            format: '1920x1080i',
            fieldRate: '100Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '1:1',
        },
        {
            vic: 41,
            format: '1280x720p',
            fieldRate: '100Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '1:1',
        },
        {
            vic: 42,
            format: '720x576p',
            fieldRate: '100Hz',
            pictureAspectRatio: '4:3',
            pixelAspectRatio: '16:15',
        },
        {
            vic: 43,
            format: '720x576p',
            fieldRate: '100Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '64:45',
        },
        {
            vic: 44,
            format: '720(1440)x576i',
            fieldRate: '100Hz',
            pictureAspectRatio: '4:3',
            pixelAspectRatio: '16:15',
        },
        {
            vic: 45,
            format: '720(1440)x576i',
            fieldRate: '100Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '64:45',
        },
        {
            vic: 46,
            format: '1920x1080i',
            fieldRate: '119.88/120Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '1:1',
        },
        {
            vic: 47,
            format: '1280x720p',
            fieldRate: '119.88/120Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '1:1',
        },
        {
            vic: 48,
            format: '720x480p',
            fieldRate: '119.88/120Hz',
            pictureAspectRatio: '4:3',
            pixelAspectRatio: '8:9',
        },
        {
            vic: 49,
            format: '720x480p',
            fieldRate: '119.88/120Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '32:27',
        },
        {
            vic: 50,
            format: '720(1440)x480i',
            fieldRate: '119.88/120Hz',
            pictureAspectRatio: '4:3',
            pixelAspectRatio: '8:9',
        },
        {
            vic: 51,
            format: '720(1440)x480i',
            fieldRate: '119.88/120Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '32:27',
        },
        {
            vic: 52,
            format: '720x576p',
            fieldRate: '200Hz',
            pictureAspectRatio: '4:3',
            pixelAspectRatio: '16:15',
        },
        {
            vic: 53,
            format: '720x576p',
            fieldRate: '200Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '64:45',
        },
        {
            vic: 54,
            format: '720(1440)x576i',
            fieldRate: '200Hz',
            pictureAspectRatio: '4:3',
            pixelAspectRatio: '16:15',
        },
        {
            vic: 55,
            format: '720(1440)x576i',
            fieldRate: '200Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '64:45',
        },
        {
            vic: 56,
            format: '720x480p',
            fieldRate: '239.76/240Hz',
            pictureAspectRatio: '4:3',
            pixelAspectRatio: '8:9',
        },
        {
            vic: 57,
            format: '720x480p',
            fieldRate: '239.76/240Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '32:27',
        },
        {
            vic: 58,
            format: '720(1440)x480i',
            fieldRate: '239.76/240Hz',
            pictureAspectRatio: '4:3',
            pixelAspectRatio: '8:9',
        },
        {
            vic: 59,
            format: '720(1440)x480i',
            fieldRate: '239.76/240Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '32:27',
        },
        {
            vic: 60,
            format: '1280x720p',
            fieldRate: '23.97Hz/24Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '1:1',
        },
        {
            vic: 61,
            format: '1280x720p',
            fieldRate: '25Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '1:1',
        },
        {
            vic: 62,
            format: '1280x720p',
            fieldRate: '29.97Hz/30Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '1:1',
        },
        {
            vic: 63,
            format: '1920x1080p',
            fieldRate: '119.88/120Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '1:1',
        },
        {
            vic: 64,
            format: '1920x1080p',
            fieldRate: '100Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '1:1',
        },
        {
            vic: 65,
            format: '1280x720p',
            fieldRate: '23.98Hz/24Hz',
            pictureAspectRatio: '64:27',
            pixelAspectRatio: '4:3',
        },
        {
            vic: 66,
            format: '1280x720p',
            fieldRate: '25Hz',
            pictureAspectRatio: '64:27',
            pixelAspectRatio: '4:3',
        },
        {
            vic: 67,
            format: '1280x720p',
            fieldRate: '29.97Hz/30Hz',
            pictureAspectRatio: '64:27',
            pixelAspectRatio: '4:3',
        },
        {
            vic: 68,
            format: '1280x720p',
            fieldRate: '50Hz',
            pictureAspectRatio: '64:27',
            pixelAspectRatio: '4:3',
        },
        {
            vic: 69,
            format: '1280x720p',
            fieldRate: '59.94Hz/60Hz',
            pictureAspectRatio: '64:27',
            pixelAspectRatio: '4:3',
        },
        {
            vic: 70,
            format: '1280x720p',
            fieldRate: '100Hz',
            pictureAspectRatio: '64:27',
            pixelAspectRatio: '4:3',
        },
        {
            vic: 71,
            format: '1280x720p',
            fieldRate: '119.88Hz/120Hz',
            pictureAspectRatio: '64:27',
            pixelAspectRatio: '4:3',
        },
        {
            vic: 72,
            format: '1920x1080p',
            fieldRate: '23.98Hz/24Hz',
            pictureAspectRatio: '64:27',
            pixelAspectRatio: '4:3',
        },
        {
            vic: 73,
            format: '1920x1080p',
            fieldRate: '25Hz',
            pictureAspectRatio: '64:27',
            pixelAspectRatio: '4:3',
        },
        {
            vic: 74,
            format: '1920x1080p',
            fieldRate: '29.97Hz/30Hz',
            pictureAspectRatio: '64:27',
            pixelAspectRatio: '4:3',
        },
        {
            vic: 75,
            format: '1920x1080p',
            fieldRate: '50Hz',
            pictureAspectRatio: '64:27',
            pixelAspectRatio: '4:3',
        },
        {
            vic: 76,
            format: '1920x1080p',
            fieldRate: '59.94Hz/60Hz',
            pictureAspectRatio: '64:27',
            pixelAspectRatio: '4:3',
        },
        {
            vic: 77,
            format: '1920x1080p',
            fieldRate: '100Hz',
            pictureAspectRatio: '64:27',
            pixelAspectRatio: '4:3',
        },
        {
            vic: 78,
            format: '1920x1080p',
            fieldRate: '119.88Hz/120Hz',
            pictureAspectRatio: '64:27',
            pixelAspectRatio: '4:3',
        },
        {
            vic: 79,
            format: '1680x720p',
            fieldRate: '23.98Hz/24Hz',
            pictureAspectRatio: '64:27',
            pixelAspectRatio: '64:63',
        },
        {
            vic: 80,
            format: '1680x720p',
            fieldRate: '25Hz',
            pictureAspectRatio: '64:27',
            pixelAspectRatio: '64:63',
        },
        {
            vic: 81,
            format: '1680x720p',
            fieldRate: '29.97Hz/30Hz',
            pictureAspectRatio: '64:27',
            pixelAspectRatio: '64:63',
        },
        {
            vic: 82,
            format: '1680x720p',
            fieldRate: '50Hz',
            pictureAspectRatio: '64:27',
            pixelAspectRatio: '64:63',
        },
        {
            vic: 83,
            format: '1680x720p',
            fieldRate: '59.94Hz/60Hz',
            pictureAspectRatio: '64:27',
            pixelAspectRatio: '64:63',
        },
        {
            vic: 84,
            format: '1680x720p',
            fieldRate: '100Hz',
            pictureAspectRatio: '64:27',
            pixelAspectRatio: '64:63',
        },
        {
            vic: 85,
            format: '1680x720p',
            fieldRate: '119.88Hz/120Hz',
            pictureAspectRatio: '64:27',
            pixelAspectRatio: '64:63',
        },
        {
            vic: 86,
            format: '2560p1080p',
            fieldRate: '23.98Hz/24Hz',
            pictureAspectRatio: '64:27',
            pixelAspectRatio: '1:1',
        },
        {
            vic: 87,
            format: '2560p1080p',
            fieldRate: '25Hz',
            pictureAspectRatio: '64:27',
            pixelAspectRatio: '1:1',
        },
        {
            vic: 88,
            format: '2560p1080p',
            fieldRate: '29.97Hz/30Hz',
            pictureAspectRatio: '64:27',
            pixelAspectRatio: '1:1',
        },
        {
            vic: 89,
            format: '2560p1080p',
            fieldRate: '50Hz',
            pictureAspectRatio: '64:27',
            pixelAspectRatio: '1:1',
        },
        {
            vic: 90,
            format: '2560p1080p',
            fieldRate: '59.94Hz/60Hz',
            pictureAspectRatio: '64:27',
            pixelAspectRatio: '1:1',
        },
        {
            vic: 91,
            format: '2560p1080p',
            fieldRate: '100Hz',
            pictureAspectRatio: '64:27',
            pixelAspectRatio: '1:1',
        },
        {
            vic: 92,
            format: '2560p1080p',
            fieldRate: '119.88Hz/120Hz',
            pictureAspectRatio: '64:27',
            pixelAspectRatio: '1:1',
        },
        {
            vic: 93,
            format: '3840x2160p',
            fieldRate: '23.98Hz/24Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '1:1',
        },
        {
            vic: 94,
            format: '3840x2160p',
            fieldRate: '25Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '1:1',
        },
        {
            vic: 95,
            format: '3840x2160p',
            fieldRate: '29.97Hz/30Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '1:1',
        },
        {
            vic: 96,
            format: '3840x2160p',
            fieldRate: '50Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '1:1',
        },
        {
            vic: 97,
            format: '3840x2160p',
            fieldRate: '59.94Hz/60Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '1:1',
        },
        {
            vic: 98,
            format: '4096x2160p',
            fieldRate: '23.98Hz/24Hz',
            pictureAspectRatio: '256:135',
            pixelAspectRatio: '1:1',
        },
        {
            vic: 99,
            format: '4096x2160p',
            fieldRate: '25Hz',
            pictureAspectRatio: '256:135',
            pixelAspectRatio: '1:1',
        },
        {
            vic: 100,
            format: '4096x2160p',
            fieldRate: '29.97Hz/30Hz',
            pictureAspectRatio: '256:135',
            pixelAspectRatio: '1:1',
        },
        {
            vic: 101,
            format: '4096x2160p',
            fieldRate: '50Hz',
            pictureAspectRatio: '256:135',
            pixelAspectRatio: '1:1',
        },
        {
            vic: 102,
            format: '4096x2160p',
            fieldRate: '59.94Hz/60Hz',
            pictureAspectRatio: '256:135',
            pixelAspectRatio: '1:1',
        },
        {
            vic: 103,
            format: '3840x2160p',
            fieldRate: '23.98Hz/24Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '1:1',
        },
        {
            vic: 104,
            format: '3840x2160p',
            fieldRate: '25Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '1:1',
        },
        {
            vic: 105,
            format: '3840x2160p',
            fieldRate: '29.97Hz/30Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '1:1',
        },
        {
            vic: 106,
            format: '3840x2160p',
            fieldRate: '50Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '1:1',
        },
        {
            vic: 107,
            format: '3840x2160p',
            fieldRate: '59.94Hz/60Hz',
            pictureAspectRatio: '16:9',
            pixelAspectRatio: '1:1',
        },
    ];

    public speakerAllocation = [
        'Front Left/Front Right (FL/FR)',
        'Low Frequency Effort (LFE)',
        'Front Center (FC)',
        'Rear Left/Rear Right (RL/RR)',
        'Rear Center (RC)',
        'Front Left Center/Front Right Center (FLC/FRC)',
        'Rear Left Center/Rear Right Center (RLC/RRC)',
        'Front Left Wide/Front Right Wide (FLW/FRW)',
        'Front Left High/Frong Right High (FLH/FRH)',
        'Top Center (TC)',
        'Front Center High (FCH)',
    ];

    constructor() {}

    public setEdidData(edid: number[]): void {
        this.edidData = edid;
    }

    public parse(): void {
        if(this.validateHeader()) {
            this.validHeader = 'OK';
        } else {
            this.validHeader = 'ERROR';
        }

        this.displaySize = this.getDisplaySize();
        this.eisaId = this.getEisaId();
        this.productCode = this.getProductCode();
        this.serialNumber = this.getSerialNumber();
        const week = this.getManufactureWeek();
        const year = this.getManufactureYear();
        if(!isNaN(year)) {
            this.manufactureDate = !isNaN(week) ? `${week}/${year}` : `${year}`;
        } else {
            this.manufactureDate = '';
        }
        const version = this.getEdidVersion();
        const revision = this.getEdidRevision();
        this.edidVersion = version
            ? revision
                ? `${version}.${revision}`
                : version.toString()
            : '';
        this.bdp = this.getBasicDisplayParams();
        this.chromaticity = this.getChromaticityCoordinates();
        this.timingBitmap = this.getTimingBitmap();
        this.standardDisplayModes = this.getStandardDisplayModes();
        this.dtds = this.getDtds();
        this.numberOfExtensions = this.getNumberExtensions();
        this.checksum = this.getChecksum();
        this.exts = [];

        // parse extension blocks
        for(let extIndex = 0; extIndex < this.numberOfExtensions; extIndex++) {
            this.exts[extIndex] = {};
            this.exts[extIndex].blockNumber = extIndex + 1;
            this.exts[extIndex].extTag = this.getExtTag(extIndex);
            this.exts[extIndex].revisionNumber = this.getRevisionNumber(extIndex);
            this.exts[extIndex].dtdStart = this.getDtdStart(extIndex);
            this.exts[extIndex].numDtds = this.getNumberExtDtds(extIndex);
            this.exts[extIndex].underscan = this.getUnderscan(extIndex);
            this.exts[extIndex].basicAudio = this.getBasicAudio(extIndex);
            this.exts[extIndex].ycbcr444 = this.getYcBcR444(extIndex);
            this.exts[extIndex].ycbcr422 = this.getYcBcR422(extIndex);

            // data block collection
            if(this.exts[extIndex].dtdStart !== 4) {
                this.exts[extIndex].dataBlockCollection = this.parseDataBlockCollection(extIndex);
            }
            // DTDs
            this.exts[extIndex].dtds = this.getExtDtds(extIndex, this.exts[extIndex].dtdStart);
            // extension block checksum
            this.exts[extIndex].checksum = this.getExtChecksum(extIndex);
        }
    }

    public validateHeader(): boolean {
        return (
            this.edidData[0] === 0x00 &&
            this.edidData[1] === 0xff &&
            this.edidData[2] === 0xff &&
            this.edidData[3] === 0xff &&
            this.edidData[4] === 0xff &&
            this.edidData[5] === 0xff &&
            this.edidData[6] === 0xff &&
            this.edidData[7] === 0x00
        );
    }

    public getEisaId(): string {
        const FIVE_BIT_LETTER_MASK = 0x1f;
        const EISA_ID_BYTE1 = 8;
        const EISA_ID_BYTE2 = 9;
        const EISA_LETTER1_OFF = 2;
        const EISA_LETTER2_OFF = 5;
        const LETTER2_TOP_BYTES = 3;
        const LETTER2_TOP_MASK = 0x03;
        const LETTER2_BOT_MASK = 0x07;

        const firstLetter =
            (this.edidData[EISA_ID_BYTE1] >> EISA_LETTER1_OFF) & FIVE_BIT_LETTER_MASK;

        // second letter top bits
        const secondLetterTop = this.edidData[EISA_ID_BYTE1] & LETTER2_TOP_MASK;
        // second letter bottom bits
        const secondLetterBottom =
            (this.edidData[EISA_ID_BYTE2] >> EISA_LETTER2_OFF) & LETTER2_BOT_MASK;
        const secondLetter = (secondLetterTop << LETTER2_TOP_BYTES) | secondLetterBottom;

        const thirdLetter = this.edidData[EISA_ID_BYTE2] & FIVE_BIT_LETTER_MASK;

        // combine
        const l1 = intToAscii(firstLetter) || '';
        const l2 = intToAscii(secondLetter) || '';
        const l3 = intToAscii(thirdLetter) || '';
        return l1 + l2 + l3;
    }

    public getDisplaySize(): [number, number] | null {
        if(this.edidData[0x15] && this.edidData[0x16]) {
            return [this.edidData[0x15] * 10, this.edidData[0x16] * 10];
        }
        return null;
    }

    public getProductCode(): number {
        const PRODUCT_CODE1 = 10;
        const PRODUCT_CODE2 = 11;
        return (this.edidData[PRODUCT_CODE2] << 8) | this.edidData[PRODUCT_CODE1];
    }

    public getSerialNumber(): number | string {
        const SERIAL_NUMBER1 = 12;
        const SERIAL_NUMBER2 = 13;
        const SERIAL_NUMBER3 = 14;
        const SERIAL_NUMBER4 = 15;

        // attempt descriptor search
        let snStartIndex: false | number = false;
        for(let k = 0; !snStartIndex && k < this.edidData.length - 5; k++) {
            if(
                this.edidData[k] === 0 &&
                this.edidData[k + 1] === 0 &&
                this.edidData[k + 2] === 0 &&
                this.edidData[k + 3] === 0xff &&
                this.edidData[k + 4] === 0
            ) {
                snStartIndex = k + 5;
            }
        }
        if(snStartIndex !== false) {
            let serialNumber = '';
            let snIndex = snStartIndex;
            const endOfSnChar = ['a', '1', '0']; // hex representation of some terminators?
            while(
                snIndex < this.edidData.length &&
                endOfSnChar.indexOf(this.edidData[snIndex].toString(16)) < 0
            ) {
                serialNumber += String.fromCharCode(this.edidData[snIndex]);
                snIndex++;
            }
            return serialNumber;
        }
        // fallback to numeric
        return (
            (this.edidData[SERIAL_NUMBER4] << 24) |
            (this.edidData[SERIAL_NUMBER3] << 16) |
            (this.edidData[SERIAL_NUMBER2] << 8) |
            this.edidData[SERIAL_NUMBER1]
        );
    }

    public getManufactureWeek(): number {
        const MANUFACTURE_WEEK = 16;
        return this.edidData[MANUFACTURE_WEEK];
    }

    public getManufactureYear(): number {
        const MANUFACTURE_YEAR = 17;
        return this.edidData[MANUFACTURE_YEAR] + 1990;
    }

    public getEdidVersion(): number {
        const EDID_VERSION = 18;
        return this.edidData[EDID_VERSION];
    }

    public getEdidRevision(): number {
        const EDID_REVISION = 19;
        return this.edidData[EDID_REVISION];
    }

    public getBasicDisplayParams(): any {
        const bdp: any = {};
        const VIDEO_IN_PARAMS_BITMAP = 20;
        const DIGITAL_INPUT = 0x80;
        if(this.edidData[VIDEO_IN_PARAMS_BITMAP] & DIGITAL_INPUT) {
            const VESA_DFP_COMPATIBLE = 0x01;
            bdp.digitalInput = true;
            bdp.vesaDfpCompatible = !!(this.edidData[VIDEO_IN_PARAMS_BITMAP] & VESA_DFP_COMPATIBLE);
        } else {
            bdp.digitalInput = false;

            const WHITE_SYNC_LVLS_OFF = 5;
            const WHITE_SYNC_LVLS_MASK = 0x03;
            bdp.whiteSyncLevels =
                (this.edidData[VIDEO_IN_PARAMS_BITMAP] >> WHITE_SYNC_LVLS_OFF) &
                WHITE_SYNC_LVLS_MASK;

            const BLANK_TO_BLACK_OFF = 4;
            const BLANK_TO_BLACK_MASK = 0x01;
            bdp.blankToBlack = !!(
                (this.edidData[VIDEO_IN_PARAMS_BITMAP] >> BLANK_TO_BLACK_OFF) &
                BLANK_TO_BLACK_MASK
            );

            const SEPARATE_SYNC_OFF = 3;
            const SEPARATE_SYNC_MASK = 0x01;
            bdp.separateSyncSupported = !!(
                (this.edidData[VIDEO_IN_PARAMS_BITMAP] >> SEPARATE_SYNC_OFF) &
                SEPARATE_SYNC_MASK
            );

            const COMPOSITE_SYNC_OFF = 2;
            const COMPOSITE_SYNC_MASK = 0x01;
            bdp.compositeSyncSupported = !!(
                (this.edidData[VIDEO_IN_PARAMS_BITMAP] >> COMPOSITE_SYNC_OFF) &
                COMPOSITE_SYNC_MASK
            );

            const SYNC_ON_GREEN_OFF = 1;
            const SYNC_ON_GREEN_MASK = 0x01;
            bdp.synOnGreen = !!(
                (this.edidData[VIDEO_IN_PARAMS_BITMAP] >> SYNC_ON_GREEN_OFF) &
                SYNC_ON_GREEN_MASK
            );

            const VSYNC_SERRATED_MASK = 0x01;
            bdp.vsyncSerrated = !!(this.edidData[VIDEO_IN_PARAMS_BITMAP] & VSYNC_SERRATED_MASK);
        }

        const MAX_HOR_IMG_SIZE = 21;
        bdp.maxHorImgSize = this.edidData[MAX_HOR_IMG_SIZE];

        const MAX_VERT_IMG_SIZE = 22;
        bdp.maxVertImgSize = this.edidData[MAX_VERT_IMG_SIZE];

        const DISPLAY_GAMMA = 23;
        bdp.displayGamma = this.edidData[DISPLAY_GAMMA] * (2.54 / 255) + 1;

        const SUPPORTED_FEATURES_BITMAP = 24;
        const DPMS_STANDBY = 0x80;
        bdp.dpmsStandby = !!(this.edidData[SUPPORTED_FEATURES_BITMAP] & DPMS_STANDBY);

        const DPMS_SUSPEND = 0x40;
        bdp.dpmsSuspend = !!(this.edidData[SUPPORTED_FEATURES_BITMAP] & DPMS_SUSPEND);

        const DPMS_ACTIVE_OFF = 0x20;
        bdp.dpmsActiveOff = !!(this.edidData[SUPPORTED_FEATURES_BITMAP] & DPMS_ACTIVE_OFF);

        const DISPLAY_TYPE_OFF = 3;
        const DISPLAY_TYPE_MASK = 0x03;
        bdp.displayType =
            (this.edidData[SUPPORTED_FEATURES_BITMAP] >> DISPLAY_TYPE_OFF) & DISPLAY_TYPE_MASK;

        const STANDARD_SRGB = 0x04;
        bdp.standardSRgb = !!(this.edidData[SUPPORTED_FEATURES_BITMAP] & STANDARD_SRGB);

        const PREFERRED_TIMING = 0x02;
        bdp.preferredTiming = !!(this.edidData[SUPPORTED_FEATURES_BITMAP] & PREFERRED_TIMING);

        const GTF_SUPPORTED = 0x01;
        bdp.gtfSupported = !!(this.edidData[SUPPORTED_FEATURES_BITMAP] & GTF_SUPPORTED);

        return bdp;
    }

    public getChromaticityCoordinates(): any {
        const chromaticity: any = {};
        const TWO_BIT_MASK = 0x03;
        const TWO_BIT_OFF = 2;
        const FOUR_BIT_OFF = 4;
        const SIX_BIT_OFF = 6;

        const RED_GREEN_LSB = 25;
        const RED_X_MSB = 27;
        chromaticity.redX =
            (this.edidData[RED_X_MSB] << TWO_BIT_OFF) |
            ((this.edidData[RED_GREEN_LSB] >> SIX_BIT_OFF) & TWO_BIT_MASK);
        chromaticity.redXCoords = chromaticity.redX / 1024;

        const RED_Y_MSB = 28;
        chromaticity.redY =
            (this.edidData[RED_Y_MSB] << TWO_BIT_OFF) |
            ((this.edidData[RED_GREEN_LSB] >> FOUR_BIT_OFF) & TWO_BIT_MASK);
        chromaticity.redYCoords = chromaticity.redY / 1024;

        const GREEN_X_MSB = 29;
        chromaticity.greenX =
            (this.edidData[GREEN_X_MSB] << TWO_BIT_OFF) |
            ((this.edidData[RED_GREEN_LSB] >> TWO_BIT_OFF) & TWO_BIT_MASK);
        chromaticity.greenXCoords = chromaticity.greenX / 1024;

        const GREEN_Y_MSB = 30;
        chromaticity.greenY =
            (this.edidData[GREEN_Y_MSB] << TWO_BIT_OFF) |
            (this.edidData[RED_GREEN_LSB] & TWO_BIT_MASK);
        chromaticity.greenYCoords = chromaticity.greenY / 1024;

        const BLUE_WHITE_LSB = 26;
        const BLUE_X_MSB = 31;
        chromaticity.blueX =
            (this.edidData[BLUE_X_MSB] << TWO_BIT_OFF) |
            ((this.edidData[BLUE_WHITE_LSB] >> SIX_BIT_OFF) & TWO_BIT_MASK);
        chromaticity.blueXCoords = chromaticity.blueX / 1024;

        const BLUE_Y_MSB = 32;
        chromaticity.blueY =
            (this.edidData[BLUE_Y_MSB] << TWO_BIT_OFF) |
            ((this.edidData[BLUE_WHITE_LSB] >> FOUR_BIT_OFF) & TWO_BIT_MASK);
        chromaticity.blueYCoords = chromaticity.blueY / 1024;

        const WHITE_X_MSB = 33;
        chromaticity.whiteX =
            (this.edidData[WHITE_X_MSB] << TWO_BIT_OFF) |
            ((this.edidData[BLUE_WHITE_LSB] >> TWO_BIT_OFF) & TWO_BIT_MASK);
        chromaticity.whiteXCoords = chromaticity.whiteX / 1024;

        const WHITE_Y_MSB = 34;
        chromaticity.whiteY =
            (this.edidData[WHITE_Y_MSB] << TWO_BIT_OFF) |
            (this.edidData[BLUE_WHITE_LSB] & TWO_BIT_MASK);
        chromaticity.whiteYCoords = chromaticity.whiteY / 1024;

        return chromaticity;
    }

    public getTimingBitmap(): number {
        const TIMING_BITMAP1 = 35;
        const TIMING_BITMAP2 = 36;
        const TIMING_BITMAP3 = 37;
        return (
            (this.edidData[TIMING_BITMAP1] << 16) |
            (this.edidData[TIMING_BITMAP2] << 8) |
            this.edidData[TIMING_BITMAP3]
        );
    }

    public getStandardDisplayModes(): any[] {
        const STD_DISPLAY_MODES_START = 38;
        const STD_DISPLAY_MODES_END = 53;

        const stdDispModesArray: any[] = [];
        let arrayCounter = 0;
        let index = STD_DISPLAY_MODES_START;

        while(index < STD_DISPLAY_MODES_END) {
            if(this.edidData[index] !== 0x01 && this.edidData[index + 1] !== 0x01) {
                const standardDisplayModes: any = {};
                standardDisplayModes.xResolution = (this.edidData[index] + 31) * 8;

                const XY_PIXEL_RATIO_OFF = 6;
                const XY_PIXEL_RATIO_MASK = 0x03;
                standardDisplayModes.xyPixelRatio =
                    (this.edidData[index + 1] >> XY_PIXEL_RATIO_OFF) & XY_PIXEL_RATIO_MASK;

                const VERTICAL_FREQUENCY_MASK = 0x3f;
                standardDisplayModes.vertFreq =
                    (this.edidData[index + 1] & VERTICAL_FREQUENCY_MASK) + 60;

                stdDispModesArray[arrayCounter] = standardDisplayModes;
                arrayCounter++;
            }
            index += 2;
        }

        return stdDispModesArray;
    }

    public parseDtd(dtdIndex: number): any {
        const dtd: any = {};

        dtd.pixelClock = ((this.edidData[dtdIndex + 1] << 8) | this.edidData[dtdIndex]) / 100;

        const HOR_ACTIVE_OFF = 4;
        const HOR_ACTIVE_PIX_MASK = 0x0f;
        dtd.horActivePixels =
            (((this.edidData[dtdIndex + 4] >> HOR_ACTIVE_OFF) & HOR_ACTIVE_PIX_MASK) << 8) |
            this.edidData[dtdIndex + 2];

        const HOR_BLANK_MASK = 0x0f;
        dtd.horBlankPixels =
            ((this.edidData[dtdIndex + 4] & HOR_BLANK_MASK) << 8) | this.edidData[dtdIndex + 3];

        const VERT_ACTIVE_OFF = 4;
        const VERT_ACTIVE_MASK = 0x0f;
        dtd.vertActivePixels =
            (((this.edidData[dtdIndex + 7] >> VERT_ACTIVE_OFF) & VERT_ACTIVE_MASK) << 8) |
            this.edidData[dtdIndex + 5];

        const VERT_BLANK_MASK = 0x0f;
        dtd.vertBlankPixels =
            ((this.edidData[dtdIndex + 7] & VERT_BLANK_MASK) << 8) | this.edidData[dtdIndex + 6];

        const HOR_SYNC_OFF_OFF = 6;
        const HOR_SYNC_OFF_MASK = 0x03;
        dtd.horSyncOff =
            (((this.edidData[dtdIndex + 11] >> HOR_SYNC_OFF_OFF) & HOR_SYNC_OFF_MASK) << 8) |
            this.edidData[dtdIndex + 8];

        const HOR_SYNC_PULSE_OFF = 4;
        const HOR_SYNC_PULSE_MASK = 0x03;
        dtd.horSyncPulse =
            (((this.edidData[dtdIndex + 11] >> HOR_SYNC_PULSE_OFF) & HOR_SYNC_PULSE_MASK) << 8) |
            this.edidData[dtdIndex + 9];

        const VERT_SYNC_OFF_TOP_OFF = 2;
        const VERT_SYNC_OFF_TOP_MASK = 0x03;
        const VERT_SYNC_OFF_BOT_OFF = 4;
        const VERT_SYNC_OFF_BOT_MASK = 0x0f;
        dtd.vertSyncOff =
            (((this.edidData[dtdIndex + 11] >> VERT_SYNC_OFF_TOP_OFF) & VERT_SYNC_OFF_TOP_MASK) <<
                4) |
            ((this.edidData[dtdIndex + 10] >> VERT_SYNC_OFF_BOT_OFF) & VERT_SYNC_OFF_BOT_MASK);

        const VERT_SYNC_PULSE_TOP_MASK = 0x03;
        const VERT_SYNC_PULSE_BOT_MASK = 0x0f;
        dtd.vertSyncPulse =
            ((this.edidData[dtdIndex + 11] & VERT_SYNC_PULSE_TOP_MASK) << 4) |
            (this.edidData[dtdIndex + 10] & VERT_SYNC_PULSE_BOT_MASK);

        const HOR_DISPLAY_TOP_OFF = 4;
        const HOR_DISPLAY_TOP_MASK = 0x0f;
        dtd.horDisplaySize =
            (((this.edidData[dtdIndex + 14] >> HOR_DISPLAY_TOP_OFF) & HOR_DISPLAY_TOP_MASK) << 8) |
            this.edidData[dtdIndex + 12];

        const VERT_DISPLAY_TOP_MASK = 0x0f;
        dtd.vertDisplaySize =
            ((this.edidData[dtdIndex + 14] & VERT_DISPLAY_TOP_MASK) << 8) |
            this.edidData[dtdIndex + 13];

        dtd.horBorderPixels = this.edidData[dtdIndex + 15];
        dtd.vertBorderLines = this.edidData[dtdIndex + 16];

        const INTERLACED_MASK = 0x80;
        dtd.interlaced = !!(this.edidData[dtdIndex + 17] & INTERLACED_MASK);

        const STEREO_MODE_OFFSET = 5;
        const STEREO_MODE_MASK = 0x03;
        dtd.stereoMode = (this.edidData[dtdIndex + 17] >> STEREO_MODE_OFFSET) & STEREO_MODE_MASK;

        const SYNC_TYPE_OFFSET = 3;
        const SYNC_TYPE_MASK = 0x03;
        dtd.syncType = (this.edidData[dtdIndex + 17] >> SYNC_TYPE_OFFSET) & SYNC_TYPE_MASK;

        if(dtd.syncType === this.syncTypeEnum.DIGITAL_SEPARATE) {
            const VSYNC_POLARITY_MASK = 0x04;
            dtd.vSyncPolarity = !!(this.edidData[dtdIndex + 17] & VSYNC_POLARITY_MASK);
        } else {
            const VSYNC_SERRATED_MASK = 0x04;
            dtd.vSyncSerrated = !!(this.edidData[dtdIndex + 17] & VSYNC_SERRATED_MASK);
        }

        if(
            dtd.syncType === this.syncTypeEnum.ANALOG_COMPOSITE ||
            dtd.syncType === this.syncTypeEnum.BIPOLAR_ANALOG_COMPOSITE
        ) {
            const SYNC_ALL_RGB_MASK = 0x02;
            dtd.syncAllRGBLines = !!(this.edidData[dtdIndex + 17] & SYNC_ALL_RGB_MASK);
        } else {
            const HSYNC_POLARY_MASK = 0x02;
            dtd.hSyncPolarity = !!(this.edidData[dtdIndex + 17] & HSYNC_POLARY_MASK);
        }

        const TWO_WAY_STEREO_MASK = 0x01;
        dtd.twoWayStereo = !!(this.edidData[dtdIndex + 17] & TWO_WAY_STEREO_MASK);

        return dtd;
    }

    public getDtds(): any[] {
        const dtdArray: any[] = [];
        let dtdCounter = 0;

        const DTD_START = 54;
        const DTD_END = 125;

        let dtdIndex = DTD_START;

        while(
            (this.edidData[dtdIndex] !== 0 || this.edidData[dtdIndex + 1] !== 0) &&
            dtdIndex < DTD_END
        ) {
            const dtd = this.parseDtd(dtdIndex);
            dtdArray[dtdCounter] = dtd;
            dtdCounter++;
            dtdIndex += this.DTD_LENGTH;
        }

        // Add model name parser
        while(this.edidData[dtdIndex] === 0 && dtdIndex < DTD_END) {
            if(this.edidData[dtdIndex + 3] === 0xfc) {
                let modelname = '';
                for(
                    let k = dtdIndex + 5;
                    this.edidData[k] !== 0x0a && this.edidData[k] !== 0x00;
                    k++
                ) {
                    const ch = String.fromCharCode(this.edidData[k]);
                    if(ch) {
                        modelname += ch;
                    }
                }
                this.modelName = modelname.trim();
            }
            dtdIndex += this.DTD_LENGTH;
        }

        return dtdArray;
    }

    public getNumberExtensions(): number {
        const NUMBER_OF_EXTENSIONS = 126;
        return this.edidData[NUMBER_OF_EXTENSIONS];
    }

    public getChecksum(): number {
        const CHECKSUM = 127;
        return this.edidData[CHECKSUM];
    }

    public calcChecksum(block: number): number {
        const startAddress = block * this.EDID_BLOCK_LENGTH;
        const endAddress = startAddress + this.EDID_BLOCK_LENGTH - 1;
        let checksum = 0;
        for(let index = startAddress; index < endAddress; index++) {
            checksum += this.edidData[index];
        }
        return 256 - (checksum % 256);
    }

    public validChecksum(block: number): boolean {
        const checksum = this.edidData[(block + 1) * this.EDID_BLOCK_LENGTH - 1];
        const calculatedChecksum = this.calcChecksum(block);
        return checksum === calculatedChecksum;
    }

    public getExtTag(extIndex: number): number {
        const BLOCK_OFFSET = this.EDID_BLOCK_LENGTH * (extIndex + 1);
        const EXT_TAG = BLOCK_OFFSET + 0;
        return this.edidData[EXT_TAG];
    }

    public getRevisionNumber(extIndex: number): number {
        const BLOCK_OFFSET = this.EDID_BLOCK_LENGTH * (extIndex + 1);
        const REV_NUMBER = BLOCK_OFFSET + 1;
        return this.edidData[REV_NUMBER];
    }

    public getDtdStart(extIndex: number): number {
        const BLOCK_OFFSET = this.EDID_BLOCK_LENGTH * (extIndex + 1);
        const DTD_START = BLOCK_OFFSET + 2;
        return this.edidData[DTD_START];
    }

    public getNumberExtDtds(extIndex: number): number {
        const BLOCK_OFFSET = this.EDID_BLOCK_LENGTH * (extIndex + 1);
        const NUM_DTDS = BLOCK_OFFSET + 3;
        const NUM_DTDS_MASK = 0x0f;
        return this.edidData[NUM_DTDS] & NUM_DTDS_MASK;
    }

    public getUnderscan(extIndex: number): boolean {
        const BLOCK_OFFSET = this.EDID_BLOCK_LENGTH * (extIndex + 1);
        const UNDERSCAN = BLOCK_OFFSET + 3;
        const UNDERSCAN_MASK = 0x80;
        return !!(this.edidData[UNDERSCAN] & UNDERSCAN_MASK);
    }

    public getBasicAudio(extIndex: number): boolean {
        const BLOCK_OFFSET = this.EDID_BLOCK_LENGTH * (extIndex + 1);
        const BASIC_AUDIO = BLOCK_OFFSET + 3;
        const BASIC_AUDIO_MASK = 0x40;
        return !!(this.edidData[BASIC_AUDIO] & BASIC_AUDIO_MASK);
    }

    public getYcBcR444(extIndex: number): boolean {
        const BLOCK_OFFSET = this.EDID_BLOCK_LENGTH * (extIndex + 1);
        const YCBCR_444 = BLOCK_OFFSET + 3;
        const YCBCR_444_MASK = 0x20;
        return !!(this.edidData[YCBCR_444] & YCBCR_444_MASK);
    }

    public getYcBcR422(extIndex: number): boolean {
        const BLOCK_OFFSET = this.EDID_BLOCK_LENGTH * (extIndex + 1);
        const YCBCR_422 = BLOCK_OFFSET + 3;
        const YCBCR_422_MASK = 0x10;
        return !!(this.edidData[YCBCR_422] & YCBCR_422_MASK);
    }

    public parseDataBlockCollection(extIndex: number): any[] {
        const BLOCK_OFFSET = this.EDID_BLOCK_LENGTH * (extIndex + 1);
        const START_DATA_BLOCK = 4;
        const startAddress = BLOCK_OFFSET + START_DATA_BLOCK;
        const dataBlockLength = this.exts?.[extIndex].dtdStart - START_DATA_BLOCK;
        const endAddress = startAddress + dataBlockLength;

        const dataBlockCollection: any[] = [];

        const TAG_CODE_MASK = 0x07;
        const TAG_CODE_OFFSET = 5;
        const DATA_BLOCK_LENGTH_MASK = 0x1f;
        let index = startAddress;
        let numberDataBlocks = 0;

        while(index < endAddress) {
            const blockTagCode = (this.edidData[index] >> TAG_CODE_OFFSET) & TAG_CODE_MASK;
            const blockLength = this.edidData[index] & DATA_BLOCK_LENGTH_MASK;
            let dataBlock;

            if(blockTagCode === this.dataBlockType.AUDIO.value) {
                dataBlock = this.parseAudioDataBlock(index + 1, blockLength);
            } else if(blockTagCode === this.dataBlockType.VIDEO.value) {
                dataBlock = this.parseVideoDataBlock(index + 1, blockLength);
            } else if(blockTagCode === this.dataBlockType.VENDOR_SPECIFIC.value) {
                dataBlock = this.parseVendorDataBlock(index + 1, blockLength);
            } else if(blockTagCode === this.dataBlockType.SPEAKER_ALLOCATION.value) {
                dataBlock = this.parseSpeakerDataBlock(index + 1, blockLength);
            } else if(blockTagCode === this.dataBlockType.EXTENDED_TAG.value) {
                dataBlock = this.parseExtendedTagDataBlock(index + 1, blockLength);
            }

            dataBlockCollection[numberDataBlocks] = dataBlock;
            index += blockLength + 1;
            numberDataBlocks++;
        }
        return dataBlockCollection;
    }

    public parseAudioDataBlock(startAddress: number, blockLength: number): any {
        const audioBlock: any = [];
        const SHORT_AUDIO_DESC_LENGTH = 3;
        const numberShortAudioDescriptors = blockLength / SHORT_AUDIO_DESC_LENGTH;
        let shortAudDescIndex = 0;
        let index = startAddress;

        audioBlock.tag = this.dataBlockType.AUDIO;
        audioBlock.dataLength = blockLength;
        audioBlock.length = numberShortAudioDescriptors;
        audioBlock.shortAudioDescriptors = [];

        const SHORT_AUDIO_DESC_MASK = 0x0f;
        const SHORT_AUDIO_DESC_OFF = 3;
        const MAX_CHANNELS_MASK = 0x07;
        const SAMPLE_RATE_MASK = 0x7f;

        while(shortAudDescIndex < numberShortAudioDescriptors) {
            const shortAudDesc: any = {};
            shortAudDesc.format =
                (this.edidData[index] >> SHORT_AUDIO_DESC_OFF) & SHORT_AUDIO_DESC_MASK;
            shortAudDesc.maxChannels = (this.edidData[index] & MAX_CHANNELS_MASK) + 1;
            shortAudDesc.sampleRates = this.edidData[index + 1] & SAMPLE_RATE_MASK;

            if(shortAudDesc.format <= this.audioFormatArray[0]) {
                const BIT_DEPTH_MASK = 0x07;
                shortAudDesc.bitDepth = this.edidData[index + 2] & BIT_DEPTH_MASK;
            } else if(shortAudDesc.format <= this.audioFormatArray[1]) {
                const MAX_BIT_RATE_MASK = 0xff;
                shortAudDesc.bitRate = (this.edidData[index + 2] & MAX_BIT_RATE_MASK) * 8;
            } else if(shortAudDesc.format <= this.audioFormatArray[2]) {
                const AUDIO_FORMAT_CODE_MASK = 0xff;
                shortAudDesc.audioFormatCode = this.edidData[index + 2] & AUDIO_FORMAT_CODE_MASK;
            } else if(shortAudDesc.format <= this.audioFormatArray[3]) {
                const PROFILE_MASK = 0x07;
                shortAudDesc.profile = this.edidData[index + 2] & PROFILE_MASK;
            } else if(shortAudDesc.format <= this.audioFormatArray[4]) {
                const FORMAT_CODE_EXT_OFF = 3;
                const FORMAT_CODE_EXT_MASK = 0x1f;
                shortAudDesc.formatCodeExt =
                    (this.edidData[index + 2] >> FORMAT_CODE_EXT_OFF) & FORMAT_CODE_EXT_MASK;
            }

            audioBlock.shortAudioDescriptors[shortAudDescIndex] = shortAudDesc;
            index += SHORT_AUDIO_DESC_LENGTH;
            shortAudDescIndex++;
        }

        return audioBlock;
    }

    public parseVideoDataBlock(startAddress: number, blockLength: number): any {
        const videoBlock: any = {};
        videoBlock.tag = this.dataBlockType.VIDEO;
        videoBlock.length = blockLength;

        let index = 0;
        videoBlock.shortVideoDescriptors = [];

        const NATIVE_RESOLUTION_MASK = 0x80;
        const CEA861F_VIC_MASK = 0x40;
        const LOW_VIC_MASK = 0x3f;
        const HIGH_VIC_MASK = 0xff;

        while(index < blockLength) {
            const shortVideoDescriptor: any = {};
            const dataByte = this.edidData[startAddress + index];
            if(dataByte & CEA861F_VIC_MASK) {
                shortVideoDescriptor.vic = dataByte & HIGH_VIC_MASK;
                shortVideoDescriptor.nativeResolution = false;
            } else {
                shortVideoDescriptor.vic = dataByte & LOW_VIC_MASK;
                shortVideoDescriptor.nativeResolution = !!(dataByte & NATIVE_RESOLUTION_MASK);
            }
            videoBlock.shortVideoDescriptors[index] = shortVideoDescriptor;
            index++;
        }

        // store the video block for referencing
        (this as any).videoBlock = videoBlock;
        return videoBlock;
    }

    public parseVendorDataBlockHDMI14(
        startAddress: number,
        blockLength: number,
        vendorBlock: any
    ): any {
        const vsdbAddress = startAddress - 1;
        const PHYSICAL_ADDRESS_1 = 4;
        const PHYSICAL_ADDRESS_2 = 5;
        vendorBlock.physicalAddress =
            (this.edidData[vsdbAddress + PHYSICAL_ADDRESS_1] << 8) |
            this.edidData[vsdbAddress + PHYSICAL_ADDRESS_2];

        const AI_DC_DUAL_ADDRESS = 6;
        if(blockLength >= AI_DC_DUAL_ADDRESS) {
            const SUPPORT_AI_MASK = 0x80;
            vendorBlock.supportsAI = !!(
                this.edidData[vsdbAddress + AI_DC_DUAL_ADDRESS] & SUPPORT_AI_MASK
            );

            const DEEP_COLOR_48_MASK = 0x40;
            vendorBlock.deepColor48 = !!(
                this.edidData[vsdbAddress + AI_DC_DUAL_ADDRESS] & DEEP_COLOR_48_MASK
            );
            const DEEP_COLOR_36_MASK = 0x20;
            vendorBlock.deepColor36 = !!(
                this.edidData[vsdbAddress + AI_DC_DUAL_ADDRESS] & DEEP_COLOR_36_MASK
            );
            const DEEP_COLOR_30_MASK = 0x10;
            vendorBlock.deepColor30 = !!(
                this.edidData[vsdbAddress + AI_DC_DUAL_ADDRESS] & DEEP_COLOR_30_MASK
            );
            const DEEP_COLOR_Y444_MASK = 0x08;
            vendorBlock.deepColorY444 = !!(
                this.edidData[vsdbAddress + AI_DC_DUAL_ADDRESS] & DEEP_COLOR_Y444_MASK
            );
            const DUAL_DVI_MASK = 0x01;
            vendorBlock.dualDvi = !!(
                this.edidData[vsdbAddress + AI_DC_DUAL_ADDRESS] & DUAL_DVI_MASK
            );
        }

        const MAX_TMDS_CLOCK_ADDRESS = 7;
        if(blockLength >= MAX_TMDS_CLOCK_ADDRESS) {
            vendorBlock.maxTmdsRate = this.edidData[vsdbAddress + MAX_TMDS_CLOCK_ADDRESS] * 5;
        }

        const LATENCY_PRESENT_ADDRESS = 8;
        if(blockLength >= LATENCY_PRESENT_ADDRESS) {
            const LATENCY_FIELDS_PRESENT_MASK = 0x80;
            vendorBlock.latencyPresent = !!(
                this.edidData[vsdbAddress + LATENCY_PRESENT_ADDRESS] & LATENCY_FIELDS_PRESENT_MASK
            );

            const I_LATENCY_FIELDS_PRESENT_MASK = 0x80;
            vendorBlock.iLatencyPresent = !!(
                this.edidData[vsdbAddress + LATENCY_PRESENT_ADDRESS] & I_LATENCY_FIELDS_PRESENT_MASK
            );
        }

        // if latency present
        if(vendorBlock.latencyPresent && blockLength >= 10) {
            const VIDEO_LATENCY_ADDRESS = 9;
            vendorBlock.videoLatency = (this.edidData[vsdbAddress + VIDEO_LATENCY_ADDRESS] - 1) * 2;
            const AUDIO_LATENCY_ADDRESS = 10;
            vendorBlock.audioLatency = (this.edidData[vsdbAddress + AUDIO_LATENCY_ADDRESS] - 1) * 2;
        }

        // if interlaced latency
        if(vendorBlock.iLatencyPresent && blockLength >= 12) {
            const I_VIDEO_LATENCY_ADDRESS = 11;
            vendorBlock.iVideoLatency =
                (this.edidData[vsdbAddress + I_VIDEO_LATENCY_ADDRESS] - 1) * 2;

            const I_AUDIO_LATENCY_ADDRESS = 12;
            vendorBlock.iAudioLatency =
                (this.edidData[vsdbAddress + I_AUDIO_LATENCY_ADDRESS] - 1) * 2;
        }

        return vendorBlock;
    }

    public parseVendorDataBlockHDMI20(
        startAddress: number,
        _blockLength: number,
        vendorBlock: any
    ): any {
        const vsdbAddress = startAddress - 1;

        let FIELD_ADDRESS = 4;
        vendorBlock.versionHF = this.edidData[vsdbAddress + FIELD_ADDRESS];

        FIELD_ADDRESS = 5;
        vendorBlock.maxTmdsRateHF = this.edidData[vsdbAddress + FIELD_ADDRESS] * 5;

        FIELD_ADDRESS = 6;
        let FIELD_MASK = 0x80;
        vendorBlock.supportsSCDC = !!(this.edidData[vsdbAddress + FIELD_ADDRESS] & FIELD_MASK);

        FIELD_MASK = 0x40;
        vendorBlock.supportsSCDCRR = !!(this.edidData[vsdbAddress + FIELD_ADDRESS] & FIELD_MASK);

        FIELD_MASK = 0x08;
        vendorBlock.supportsLTE340scramble = !!(
            this.edidData[vsdbAddress + FIELD_ADDRESS] & FIELD_MASK
        );

        FIELD_MASK = 0x04;
        vendorBlock.supports3DIV = !!(this.edidData[vsdbAddress + FIELD_ADDRESS] & FIELD_MASK);

        FIELD_MASK = 0x02;
        vendorBlock.supports3DDV = !!(this.edidData[vsdbAddress + FIELD_ADDRESS] & FIELD_MASK);

        FIELD_MASK = 0x01;
        vendorBlock.supports3DOSD = !!(this.edidData[vsdbAddress + FIELD_ADDRESS] & FIELD_MASK);

        FIELD_ADDRESS = 7;
        FIELD_MASK = 0x04;
        vendorBlock.deepColorY420_30 = !!(this.edidData[vsdbAddress + FIELD_ADDRESS] & FIELD_MASK);

        FIELD_MASK = 0x02;
        vendorBlock.deepColorY420_30 =
            vendorBlock.deepColorY420_30 ||
            !!(this.edidData[vsdbAddress + FIELD_ADDRESS] & FIELD_MASK);

        FIELD_MASK = 0x01;
        vendorBlock.deepColorY420_30 =
            vendorBlock.deepColorY420_30 ||
            !!(this.edidData[vsdbAddress + FIELD_ADDRESS] & FIELD_MASK);

        return vendorBlock;
    }

    public parseVendorDataBlock(startAddress: number, blockLength: number): any {
        const vendorBlock: any = {};
        vendorBlock.tag = this.dataBlockType.VENDOR_SPECIFIC;
        vendorBlock.length = blockLength;

        const vsdbAddress = startAddress - 1;

        const IEEE_REG_IDENTIFIER_1 = 1;
        const IEEE_REG_IDENTIFIER_2 = 2;
        const IEEE_REG_IDENTIFIER_3 = 3;

        vendorBlock.ieeeIdentifier =
            (this.edidData[vsdbAddress + IEEE_REG_IDENTIFIER_3] << 16) |
            (this.edidData[vsdbAddress + IEEE_REG_IDENTIFIER_2] << 8) |
            this.edidData[vsdbAddress + IEEE_REG_IDENTIFIER_1];

        if(vendorBlock.ieeeIdentifier === this.ieeeOuiType.HDMI14.value) {
            return this.parseVendorDataBlockHDMI14(startAddress, blockLength, vendorBlock);
        } else if(vendorBlock.ieeeIdentifier === this.ieeeOuiType.HDMI20.value) {
            return this.parseVendorDataBlockHDMI20(startAddress, blockLength, vendorBlock);
        }
        return vendorBlock;
    }

    public parseVideoCapabilityDataBlock(
        startAddress: number,
        _blockLength: number,
        extendedTagBlock: any
    ): any {
        extendedTagBlock.extendedTag = this.extendedDataBlockType.VIDEO_CAPABILITY;
        const FIELD_ADDRESS = 1;
        let FIELD_MASK = 0x0;
        let FIELD_SHIFT = 0;
        let fieldData = 0;

        FIELD_MASK = 0x80;
        extendedTagBlock.quantizationRangeYCC = !!(
            this.edidData[startAddress + FIELD_ADDRESS] & FIELD_MASK
        );

        FIELD_MASK = 0x40;
        extendedTagBlock.quantizationRangeRGB = !!(
            this.edidData[startAddress + FIELD_ADDRESS] & FIELD_MASK
        );

        FIELD_MASK = 0x30;
        FIELD_SHIFT = 4;
        fieldData = (this.edidData[startAddress + FIELD_ADDRESS] & FIELD_MASK) >> FIELD_SHIFT;
        extendedTagBlock.overscanPT = this.overscanBehavior[fieldData];

        FIELD_MASK = 0x0c;
        FIELD_SHIFT = 2;
        fieldData = (this.edidData[startAddress + FIELD_ADDRESS] & FIELD_MASK) >> FIELD_SHIFT;
        extendedTagBlock.overscanIT = this.overscanBehavior[fieldData];

        FIELD_MASK = 0x03;
        FIELD_SHIFT = 0;
        fieldData = (this.edidData[startAddress + FIELD_ADDRESS] & FIELD_MASK) >> FIELD_SHIFT;
        extendedTagBlock.overscanCE = this.overscanBehavior[fieldData];

        return extendedTagBlock;
    }

    public parseColorimetryDataBlock(
        startAddress: number,
        _blockLength: number,
        extendedTagBlock: any
    ): any {
        extendedTagBlock.extendedTag = this.extendedDataBlockType.COLORIMETRY;

        let FIELD_ADDRESS = 1;
        let FIELD_MASK = 0x80;
        extendedTagBlock.supportsBT2020RGB = !!(
            this.edidData[startAddress + FIELD_ADDRESS] & FIELD_MASK
        );

        FIELD_MASK = 0x40;
        extendedTagBlock.supportsBT2020YCC = !!(
            this.edidData[startAddress + FIELD_ADDRESS] & FIELD_MASK
        );

        FIELD_MASK = 0x20;
        extendedTagBlock.supportsBT2020cYCC = !!(
            this.edidData[startAddress + FIELD_ADDRESS] & FIELD_MASK
        );

        FIELD_MASK = 0x10;
        extendedTagBlock.supportsAdobeRGB = !!(
            this.edidData[startAddress + FIELD_ADDRESS] & FIELD_MASK
        );

        FIELD_MASK = 0x08;
        extendedTagBlock.supportsAdobeYCC601 = !!(
            this.edidData[startAddress + FIELD_ADDRESS] & FIELD_MASK
        );

        FIELD_MASK = 0x04;
        extendedTagBlock.supportssYCC601 = !!(
            this.edidData[startAddress + FIELD_ADDRESS] & FIELD_MASK
        );

        FIELD_MASK = 0x02;
        extendedTagBlock.supportsxvYCC709 = !!(
            this.edidData[startAddress + FIELD_ADDRESS] & FIELD_MASK
        );

        FIELD_MASK = 0x01;
        extendedTagBlock.supportsxvYCC601 = !!(
            this.edidData[startAddress + FIELD_ADDRESS] & FIELD_MASK
        );

        FIELD_ADDRESS = 2;
        FIELD_MASK = 0x08;
        extendedTagBlock.gamutMD3 =
            this.edidData[startAddress + FIELD_ADDRESS] & FIELD_MASK ? 1 : 0;

        FIELD_MASK = 0x04;
        extendedTagBlock.gamutMD2 =
            this.edidData[startAddress + FIELD_ADDRESS] & FIELD_MASK ? 1 : 0;

        FIELD_MASK = 0x02;
        extendedTagBlock.gamutMD1 =
            this.edidData[startAddress + FIELD_ADDRESS] & FIELD_MASK ? 1 : 0;

        FIELD_MASK = 0x01;
        extendedTagBlock.gamutMD0 =
            this.edidData[startAddress + FIELD_ADDRESS] & FIELD_MASK ? 1 : 0;

        return extendedTagBlock;
    }

    public parseYCbCr420VideoDataBlock(
        startAddress: number,
        blockLength: number,
        extendedTagBlock: any
    ): any {
        extendedTagBlock.extendedTag = this.extendedDataBlockType.YCBCR420_VIDEO;

        extendedTagBlock.YCbCr420OnlyShortVideoDescriptors = [];

        const NATIVE_RESOLUTION_MASK = 0x80;
        const CEA861F_VIC_MASK = 0x40;
        const LOW_VIC_MASK = 0x3f;
        const HIGH_VIC_MASK = 0xff;

        let svdIndex = 0;
        for(svdIndex = 0; svdIndex < blockLength - 1; svdIndex++) {
            const shortVideoDescriptor: any = {};
            const dataByte = this.edidData[startAddress + 1 + svdIndex];
            if(dataByte & CEA861F_VIC_MASK) {
                shortVideoDescriptor.vic = dataByte & HIGH_VIC_MASK;
                shortVideoDescriptor.nativeResolution = false;
            } else {
                shortVideoDescriptor.vic = dataByte & LOW_VIC_MASK;
                shortVideoDescriptor.nativeResolution = !!(dataByte & NATIVE_RESOLUTION_MASK);
            }
            extendedTagBlock.YCbCr420OnlyShortVideoDescriptors[svdIndex] = shortVideoDescriptor;
        }

        return extendedTagBlock;
    }

    public parseYCbCr420CapabilityMapDataBlock(
        startAddress: number,
        blockLength: number,
        extendedTagBlock: any
    ): any {
        extendedTagBlock.extendedTag = this.extendedDataBlockType.YCBCR420_CAPABILITY_MAP;

        let FIELD_ADDRESS = 0;
        let FIELD_MASK = 0x0;
        let svdIndex = 0;
        let YCbCr420Capable = false;
        let YCbCr420svdIndex = 0;

        extendedTagBlock.YCbCr420CapableShortVideoDescriptors = [];

        // referencing the previously stored "videoBlock"
        const videoBlock = (this as any).videoBlock;

        for(FIELD_ADDRESS = 1; FIELD_ADDRESS < blockLength; FIELD_ADDRESS++) {
            for(FIELD_MASK = 0x01; FIELD_MASK <= 0x80; FIELD_MASK <<= 1) {
                YCbCr420Capable = !!(this.edidData[startAddress + FIELD_ADDRESS] & FIELD_MASK);
                if(YCbCr420Capable) {
                    extendedTagBlock.YCbCr420CapableShortVideoDescriptors[YCbCr420svdIndex] =
                        videoBlock.shortVideoDescriptors[svdIndex];
                    YCbCr420svdIndex++;
                }
                svdIndex++;
            }
        }

        return extendedTagBlock;
    }

    public parseSpeakerDataBlock(startAddress: number, blockLength: number): any {
        const speakerBlock: any = {};
        speakerBlock.tag = this.dataBlockType.SPEAKER_ALLOCATION;
        speakerBlock.length = blockLength;
        speakerBlock.payload =
            (this.edidData[startAddress + 2] << 16) |
            (this.edidData[startAddress + 1] << 8) |
            this.edidData[startAddress];
        return speakerBlock;
    }

    public parseExtendedTagDataBlock(
        startAddress: number,
        blockLength: number,
        extendedTagBlock: any = {}
    ): any {
        extendedTagBlock.tag = this.dataBlockType.EXTENDED_TAG;
        extendedTagBlock.length = blockLength;

        const EXTENDED_TAG_ADDRESS = 0;
        const extendedBlockTagCode = this.edidData[startAddress + EXTENDED_TAG_ADDRESS];

        if(extendedBlockTagCode === this.extendedDataBlockType.VIDEO_CAPABILITY.value) {
            return this.parseVideoCapabilityDataBlock(startAddress, blockLength, extendedTagBlock);
        } else if(extendedBlockTagCode === this.extendedDataBlockType.COLORIMETRY.value) {
            return this.parseColorimetryDataBlock(startAddress, blockLength, extendedTagBlock);
        } else if(extendedBlockTagCode === this.extendedDataBlockType.YCBCR420_VIDEO.value) {
            return this.parseYCbCr420VideoDataBlock(startAddress, blockLength, extendedTagBlock);
        } else if(
            extendedBlockTagCode === this.extendedDataBlockType.YCBCR420_CAPABILITY_MAP.value
        ) {
            return this.parseYCbCr420CapabilityMapDataBlock(
                startAddress,
                blockLength,
                extendedTagBlock
            );
        } else {
            extendedTagBlock.extendedTag = this.edidData[startAddress + EXTENDED_TAG_ADDRESS];
        }

        return extendedTagBlock;
    }

    public getExtChecksum(extIndex: number): number {
        const BLOCK_OFFSET = this.EDID_BLOCK_LENGTH * (extIndex + 1);
        const CHECKSUM_OFFSET = 127;
        return this.edidData[BLOCK_OFFSET + CHECKSUM_OFFSET];
    }

    public getExtDtds(extIndex: number, startAddress: number): any[] {
        const BLOCK_OFFSET = this.EDID_BLOCK_LENGTH * (extIndex + 1);
        const dtdArray: any[] = [];
        let dtdCounter = 0;
        let dtdIndex = startAddress + BLOCK_OFFSET;
        const endAddress = this.EDID_BLOCK_LENGTH * (extIndex + 2) - 2;

        while(
            (this.edidData[dtdIndex] !== 0 || this.edidData[dtdIndex + 1] !== 0) &&
            dtdIndex < endAddress
        ) {
            const dtd = this.parseDtd(dtdIndex);
            dtdArray[dtdCounter] = dtd;
            dtdCounter++;
            dtdIndex += this.DTD_LENGTH;
        }
        return dtdArray;
    }
}

/**
 * Manufacturer information for the display.
 */
export interface ManufacturerInfo {
    fullName: string;
    name: string;
}

/**
 * Basic display parameters parsed from EDID.
 */
export interface BasicDisplayParams {
    digitalInput: boolean;
    // When digitalInput is true:
    vesaDfpCompatible?: boolean;
    // When analog:
    whiteSyncLevels?: number;
    blankToBlack?: boolean;
    separateSyncSupported?: boolean;
    compositeSyncSupported?: boolean;
    synOnGreen?: boolean;
    vsyncSerrated?: boolean;
    //
    maxHorImgSize: number;
    maxVertImgSize: number;
    displayGamma: number;
    //
    dpmsStandby: boolean;
    dpmsSuspend: boolean;
    dpmsActiveOff: boolean;
    displayType: number;
    standardSRgb: boolean;
    preferredTiming: boolean;
    gtfSupported: boolean;
}

/**
 * Chromaticity coordinates with both raw and normalized values.
 */
export interface ChromaticityCoordinates {
    redX: number;
    redXCoords: number;
    redY: number;
    redYCoords: number;
    greenX: number;
    greenXCoords: number;
    greenY: number;
    greenYCoords: number;
    blueX: number;
    blueXCoords: number;
    blueY: number;
    blueYCoords: number;
    whiteX: number;
    whiteXCoords: number;
    whiteY: number;
    whiteYCoords: number;
}

/**
 * A single standard display mode, with resolution,
 * pixel ratio index, and vertical refresh rate.
 */
export interface StandardDisplayMode {
    xResolution: number;
    xyPixelRatio: number;
    vertFreq: number;
}

/**
 * Detailed Timing Descriptor (DTD) as parsed from EDID.
 */
export interface DetailedTimingDescriptor {
    pixelClock: number;
    horActivePixels: number;
    horBlankPixels: number;
    vertActivePixels: number;
    vertBlankPixels: number;
    horSyncOff: number;
    horSyncPulse: number;
    vertSyncOff: number;
    vertSyncPulse: number;
    horDisplaySize: number;
    vertDisplaySize: number;
    horBorderPixels: number;
    vertBorderLines: number;
    interlaced: boolean;
    stereoMode: number;
    syncType: number;
    vSyncPolarity?: boolean;
    vSyncSerrated?: boolean;
    hSyncPolarity?: boolean;
    twoWayStereo?: boolean;
}

/**
 * Base interface for a Consumer Electronics Association (CEA) data block.
 */
export interface CeaDataBlock {
    tag: number;
    length: number;
}

/**
 * Audio-related short descriptor.
 */
export interface ShortAudioDescriptor {
    format: number;
    maxChannels: number;
    sampleRates: number;
    bitDepth?: number;
    bitRate?: number;
    audioFormatCode?: number;
    profile?: number;
    formatCodeExt?: number;
}

/**
 * Audio Data Block containing one or more short audio descriptors.
 */
export interface AudioDataBlock extends CeaDataBlock {
    // Original block length from EDID
    blockLength: number;
    shortAudioDescriptors: ShortAudioDescriptor[];
}

/**
 * A short video descriptor.
 */
export interface ShortVideoDescriptor {
    vic: number;
    nativeResolution: boolean;
}

/**
 * Video Data Block containing one or more short video descriptors.
 */
export interface VideoDataBlock extends CeaDataBlock {
    shortVideoDescriptors: ShortVideoDescriptor[];
}

/**
 * Vendor-specific Data Block, for HDMI versions etc.
 */
export interface VendorSpecificDataBlock extends CeaDataBlock {
    ieeeIdentifier: number;
    physicalAddress?: number;
    supportsAI?: boolean;
    deepColor48?: boolean;
    deepColor36?: boolean;
    deepColor30?: boolean;
    deepColorY444?: boolean;
    dualDvi?: boolean;
    maxTmdsRate?: number;
    latencyPresent?: boolean;
    iLatencyPresent?: boolean;
    videoLatency?: number;
    audioLatency?: number;
    iVideoLatency?: number;
    iAudioLatency?: number;
    // Additional (HDMI 2.0) properties
    versionHF?: number;
    maxTmdsRateHF?: number;
    supportsSCDC?: boolean;
    supportsSCDCRR?: boolean;
    supportsLTE340scramble?: boolean;
    supports3DIV?: boolean;
    supports3DDV?: boolean;
    supports3DOSD?: boolean;
}

/**
 * Speaker allocation Data Block.
 */
export interface SpeakerAllocationDataBlock extends CeaDataBlock {
    payload: number;
}

/**
 * Extended Tag Data Blocks:
 */

/**
 * Video Capability Extended Data Block.
 */
export interface VideoCapabilityDataBlock extends CeaDataBlock {
    extendedTag: number;
    quantizationRangeYCC: boolean;
    quantizationRangeRGB: boolean;
    overscanPT: string;
    overscanIT: string;
    overscanCE: string;
}

/**
 * Colorimetry Extended Data Block.
 */
export interface ColorimetryDataBlock extends CeaDataBlock {
    extendedTag: number;
    supportsBT2020RGB: boolean;
    supportsBT2020YCC: boolean;
    supportsBT2020cYCC: boolean;
    supportsAdobeRGB: boolean;
    supportsAdobeYCC601: boolean;
    supportssYCC601: boolean;
    supportsxvYCC709: boolean;
    supportsxvYCC601: boolean;
    gamutMD3: number;
    gamutMD2: number;
    gamutMD1: number;
    gamutMD0: number;
}

/**
 * YCbCr420 Video Extended Data Block.
 */
export interface YCbCr420VideoDataBlock extends CeaDataBlock {
    extendedTag: number;
    YCbCr420OnlyShortVideoDescriptors: ShortVideoDescriptor[];
}

/**
 * YCbCr420 Capability Map Extended Data Block.
 */
export interface YCbCr420CapabilityMapDataBlock extends CeaDataBlock {
    extendedTag: number;
    YCbCr420CapableShortVideoDescriptors: ShortVideoDescriptor[];
}

/**
 * Union type for all possible data block types.
 */
export type DataBlock =
    | AudioDataBlock
    | VideoDataBlock
    | VendorSpecificDataBlock
    | SpeakerAllocationDataBlock
    | VideoCapabilityDataBlock
    | ColorimetryDataBlock
    | YCbCr420VideoDataBlock
    | YCbCr420CapabilityMapDataBlock;

/**
 * A single EDID extension block.
 */
export interface EdidExtension {
    blockNumber: number;
    extTag: number;
    revisionNumber: number;
    dtdStart: number;
    numDtds: number;
    underscan: boolean;
    basicAudio: boolean;
    ycbcr444: boolean;
    ycbcr422: boolean;
    dataBlockCollection?: DataBlock[];
    dtds: DetailedTimingDescriptor[];
    checksum: number;
}
/**
 * The EDID interface now reflects a complete and precise
 * definition of all the pertinent properties extracted from
 * raw EDID data.
 */
export interface EDID {
    validHeader: 'OK' | 'ERROR';
    displaySize: [number, number] | null;
    eisaId: string;
    eisaInfo: ManufacturerInfo | null;
    productCode: number;
    serialNumber: string | number;
    manufactureDate: string; // e.g., "12/1990"
    edidVersion: string; // e.g., "1.3"
    bdp: BasicDisplayParams;
    chromaticity: ChromaticityCoordinates;
    timingBitmap: number;
    standardDisplayModes: StandardDisplayMode[];
    dtds: DetailedTimingDescriptor[];
    numberOfExtensions: number;
    checksum: number;
    exts: EdidExtension[];
    modelName: string;
}

export class EdidParser {
    public static parseEdid(hexEdid: string): EDID | null {
        try {
            // Convert hex string to array of bytes
            const cleanHex = hexEdid.replace(/\s+/g, ''); // remove spaces if any
            const edidBytes: number[] = [];
            for(let i = 0; i < cleanHex.length; i += 2) {
                edidBytes.push(parseInt(cleanHex.substring(i, i + 2), 16));
            }

            // Create EDID object and parse
            const edid = new Edid();
            edid.setEdidData(edidBytes);
            edid.parse();

            // Optionally, look up manufacturer info if we have eisaId
            let eisaInfo: { fullName: string; name: string } | null = null;
            if(edid.eisaId) {
                const code = edid.eisaId.toUpperCase(); // Some EISA codes are uppercase
                if(combinedManufacturerData[code]) {
                    eisaInfo = combinedManufacturerData[code];
                }
            }

            return {
                validHeader: edid.validHeader ?? 'ERROR',
                displaySize: edid.displaySize ?? null,
                eisaId: edid.eisaId ?? '',
                eisaInfo,
                productCode: edid.productCode ?? 0,
                serialNumber: edid.serialNumber ?? '',
                manufactureDate: edid.manufactureDate ?? '',
                edidVersion: edid.edidVersion ?? '',
                bdp: edid.bdp,
                chromaticity: edid.chromaticity,
                timingBitmap: edid.timingBitmap ?? 0,
                standardDisplayModes: edid.standardDisplayModes ?? [],
                dtds: edid.dtds ?? [],
                numberOfExtensions: edid.numberOfExtensions ?? 0,
                checksum: edid.checksum ?? 0,
                exts: edid.exts ?? [],
                modelName: edid.modelName ?? '',
            };
        } catch(error) {
            console.error('Error parsing EDID:', error);
            return null;
        }
    }
}
